import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { clock } from "@/lib/clock";
import { getPool } from "@/lib/db";
import { getOtpProvider } from "./otp-provider";

const CHALLENGE_LIFETIME_MS = 10 * 60 * 1000;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "pb_session";
export const SESSION_MAX_AGE_SECONDS = SESSION_LIFETIME_MS / 1000;

type AuthFlow = "signup" | "sign_in";

export type Player = {
  id: string;
  displayName: string;
  phone: string;
};

type Challenge = {
  challengeId: string;
  expiresAt: string;
};

type VerifiedSession = {
  player: Player;
  sessionToken: string;
};

interface ChallengeRow extends QueryResultRow {
  id: string;
  flow: AuthFlow;
  phone: string;
  display_name: string | null;
  expires_at: Date;
  consumed_at: Date | null;
}

interface PlayerRow extends QueryResultRow {
  id: string;
  display_name: string;
  phone: string;
}

interface ExistingPlayerRow extends PlayerRow {
  signup_completed: boolean;
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

function inputRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new AuthError("invalid_request", 400);
  }
  return input as Record<string, unknown>;
}

function normalizedPhone(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError("invalid_phone", 400);
  }
  const phone = value.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new AuthError("invalid_phone", 400);
  }
  return phone;
}

function normalizedDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError("invalid_display_name", 400);
  }
  const displayName = value.trim();
  if (displayName.length === 0 || displayName.length > 100) {
    throw new AuthError("invalid_display_name", 400);
  }
  return displayName;
}

function playerFromRow(row: PlayerRow): Player {
  return {
    id: row.id,
    displayName: row.display_name,
    phone: row.phone,
  };
}

function activeChallenge(
  challenge: ChallengeRow | undefined,
  at: Date,
): ChallengeRow {
  if (!challenge || challenge.consumed_at) {
    throw new AuthError("invalid_challenge", 400);
  }
  if (challenge.expires_at.getTime() <= at.getTime()) {
    throw new AuthError("expired_code", 400);
  }
  return challenge;
}

async function createChallenge(
  flow: AuthFlow,
  phone: string,
  displayName: string | null,
): Promise<Challenge> {
  const id = randomUUID();
  const createdAt = clock.now();
  const expiresAt = new Date(createdAt.getTime() + CHALLENGE_LIFETIME_MS);
  const pool = getPool();

  await pool.query(
    `insert into auth_challenges
       (id, flow, phone, display_name, expires_at, created_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, flow, phone, displayName, expiresAt, createdAt],
  );

  try {
    await getOtpProvider().sendCode(phone);
  } catch (error) {
    await pool.query("delete from auth_challenges where id = $1", [id]);
    throw error;
  }

  return { challengeId: id, expiresAt: expiresAt.toISOString() };
}

export async function requestSignupCode(input: unknown): Promise<Challenge> {
  const body = inputRecord(input);
  const phone = normalizedPhone(body.phone);
  const displayName = normalizedDisplayName(body.displayName);
  return createChallenge("signup", phone, displayName);
}

export async function requestSignInCode(input: unknown): Promise<Challenge> {
  const body = inputRecord(input);
  const phone = normalizedPhone(body.phone);
  const existing = await getPool().query(
    `select players.id
       from players
       join player_signups on player_signups.player_id = players.id
      where players.phone = $1`,
    [phone],
  );
  if (existing.rowCount === 0) {
    throw new AuthError("player_not_found", 404);
  }
  return createChallenge("sign_in", phone, null);
}

async function createOrTakeOverPlayer(
  client: PoolClient,
  challenge: ChallengeRow,
  now: Date,
): Promise<Player> {
  if (!challenge.display_name) {
    throw new AuthError("invalid_challenge", 400);
  }
  const inserted = await client.query<PlayerRow>(
    `insert into players (id, display_name, phone, created_at)
     values ($1, $2, $3, $4)
     on conflict (phone) do nothing
     returning id, display_name, phone`,
    [randomUUID(), challenge.display_name, challenge.phone, now],
  );

  let player = inserted.rows[0] ? playerFromRow(inserted.rows[0]) : null;
  if (!player) {
    const existing = await client.query<ExistingPlayerRow>(
      `select players.id, players.display_name, players.phone,
              exists (
                select 1 from player_signups
                 where player_signups.player_id = players.id
              ) as signup_completed
         from players
        where players.phone = $1
        for update`,
      [challenge.phone],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new AuthError("invalid_challenge", 400);
    }
    if (row.signup_completed) {
      throw new AuthError("signup_already_completed", 409);
    }
    await client.query(
      "update players set display_name = $1 where id = $2",
      [challenge.display_name, row.id],
    );
    player = {
      id: row.id,
      displayName: challenge.display_name,
      phone: row.phone,
    };
  }

  await client.query(
    "insert into player_signups (player_id, completed_at) values ($1, $2)",
    [player.id, now],
  );
  return player;
}

async function findReturningPlayer(
  client: PoolClient,
  phone: string,
): Promise<Player> {
  const result = await client.query<PlayerRow>(
    `select players.id, players.display_name, players.phone
       from players
       join player_signups on player_signups.player_id = players.id
      where players.phone = $1
      for update of players`,
    [phone],
  );
  if (result.rowCount === 0) {
    throw new AuthError("player_not_found", 404);
  }
  return playerFromRow(result.rows[0]);
}

export async function verifyOtp(input: unknown): Promise<VerifiedSession> {
  const body = inputRecord(input);
  if (typeof body.challengeId !== "string" || typeof body.code !== "string") {
    throw new AuthError("invalid_request", 400);
  }

  const pool = getPool();
  const challengeResult = await pool.query<ChallengeRow>(
    `select id, flow, phone, display_name, expires_at, consumed_at
       from auth_challenges
      where id = $1`,
    [body.challengeId],
  );
  const challenge = activeChallenge(challengeResult.rows[0], clock.now());
  if (!(await getOtpProvider().checkCode(challenge.phone, body.code))) {
    throw new AuthError("invalid_code", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const lockedResult = await client.query<ChallengeRow>(
      `select id, flow, phone, display_name, expires_at, consumed_at
         from auth_challenges
        where id = $1
        for update`,
      [challenge.id],
    );
    const verifiedAt = clock.now();
    const locked = activeChallenge(lockedResult.rows[0], verifiedAt);

    const player =
      locked.flow === "signup"
        ? await createOrTakeOverPlayer(client, locked, verifiedAt)
        : await findReturningPlayer(client, locked.phone);
    const sessionToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
    const sessionExpiresAt = new Date(verifiedAt.getTime() + SESSION_LIFETIME_MS);
    await client.query(
      `insert into player_sessions
         (token_hash, player_id, expires_at, created_at)
       values ($1, $2, $3, $4)`,
      [tokenHash, player.id, sessionExpiresAt, verifiedAt],
    );
    await client.query(
      "update auth_challenges set consumed_at = $1 where id = $2",
      [verifiedAt, locked.id],
    );
    await client.query("commit");
    return { player, sessionToken };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function readPlayerSession(request: Request): Promise<Player | null> {
  const cookieHeader = request.headers.get("cookie");
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!cookie) {
    return null;
  }
  const sessionToken = cookie.slice(SESSION_COOKIE_NAME.length + 1);
  if (!sessionToken) {
    return null;
  }
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  const result = await getPool().query<PlayerRow>(
    `select players.id, players.display_name, players.phone
       from player_sessions
       join players on players.id = player_sessions.player_id
      where player_sessions.token_hash = $1
        and player_sessions.expires_at > $2`,
    [tokenHash, clock.now()],
  );
  return result.rows[0] ? playerFromRow(result.rows[0]) : null;
}

export function sessionCookieValue(sessionToken: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}
