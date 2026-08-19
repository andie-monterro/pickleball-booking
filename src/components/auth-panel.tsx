"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import styles from "./auth-panel.module.css";

type Player = {
  id: string;
  displayName: string;
  phone: string;
};

type AuthMode = "signup" | "sign-in";
type AuthStep = "details" | "code";

type AuthPanelProps = {
  returnTo?: string;
};

const AUTH_MODE_CONFIG: Record<
  AuthMode,
  {
    endpoint: string;
    collectsDisplayName: boolean;
    verifyLabel: string;
  }
> = {
  signup: {
    endpoint: "/api/auth/signup/request-code",
    collectsDisplayName: true,
    verifyLabel: "Create Player",
  },
  "sign-in": {
    endpoint: "/api/auth/sign-in/request-code",
    collectsDisplayName: false,
    verifyLabel: "Sign in",
  },
};

const ERROR_MESSAGE: Record<string, string> = {
  invalid_phone: "Enter a valid phone number with its country code, such as +84.",
  invalid_display_name: "Enter a display name with 100 characters or fewer.",
  player_not_found: "No completed signup was found for this phone number.",
  signup_already_completed: "This phone number is already registered. Use sign in instead.",
  invalid_code: "That code is not correct. Try again.",
  expired_code: "That code has expired. Request a new code.",
  invalid_challenge: "This code request is no longer valid. Request a new code.",
  otp_unavailable: "SMS verification is unavailable. Please try again later.",
};

function messageFor(error: unknown): string {
  if (typeof error === "string" && ERROR_MESSAGE[error]) {
    return ERROR_MESSAGE[error];
  }
  return "Something went wrong. Please try again.";
}

export function AuthPanel({ returnTo = "/" }: AuthPanelProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [sessionCheckAttempt, setSessionCheckAttempt] = useState(0);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [step, setStep] = useState<AuthStep>("details");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setCheckingSession(true);
    setSessionError(false);
    void fetch("/api/auth/me", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) {
          const body: { player: Player } = await response.json();
          setPlayer(body.player);
          return;
        }
        if (response.status !== 401) {
          throw new Error(`Session check returned ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSessionError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCheckingSession(false);
        }
      });
    return () => controller.abort();
  }, [sessionCheckAttempt]);

  function chooseMode(nextMode: AuthMode): void {
    if (busy) {
      return;
    }
    setMode(nextMode);
    setStep("details");
    setChallengeId("");
    setCode("");
    setMessage("");
  }

  async function requestCode(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const modeConfig = AUTH_MODE_CONFIG[mode];
    try {
      const response = await fetch(modeConfig.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone,
          ...(modeConfig.collectsDisplayName ? { displayName } : {}),
        }),
      });
      const body: { challengeId?: string; error?: string } = await response.json();
      if (!response.ok || !body.challengeId) {
        setMessage(messageFor(body.error));
        return;
      }
      setChallengeId(body.challengeId);
      setCode("");
      setStep("code");
      setMessage(`We sent a code to ${phone}.`);
    } catch {
      setMessage(messageFor(null));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const body: { player?: Player; error?: string } = await response.json();
      if (!response.ok || !body.player) {
        setMessage(messageFor(body.error));
        return;
      }
      window.location.assign(returnTo);
    } catch {
      setMessage(messageFor(null));
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) {
    return <aside className={styles.panel}>Checking your session…</aside>;
  }

  if (sessionError) {
    return (
      <aside className={styles.panel} role="alert">
        <p className={styles.sessionError}>We could not check your session.</p>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => setSessionCheckAttempt((attempt) => attempt + 1)}
        >
          Try again
        </button>
      </aside>
    );
  }

  if (player) {
    return (
      <aside className={styles.signedIn} aria-label="Signed-in Player">
        <span className={styles.statusDot} aria-hidden="true" />
        <div>
          <strong>{player.displayName}</strong>
          <span>{player.phone}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Player authentication">
      <div
        className={styles.modePicker}
        role="group"
        aria-label="Choose signup or sign in"
      >
        <button
          type="button"
          className={mode === "signup" ? styles.activeMode : styles.mode}
          aria-pressed={mode === "signup"}
          disabled={busy}
          onClick={() => chooseMode("signup")}
        >
          Sign up
        </button>
        <button
          type="button"
          className={mode === "sign-in" ? styles.activeMode : styles.mode}
          aria-pressed={mode === "sign-in"}
          disabled={busy}
          onClick={() => chooseMode("sign-in")}
        >
          Sign in
        </button>
      </div>

      {step === "details" ? (
        <form className={styles.form} onSubmit={requestCode}>
          {AUTH_MODE_CONFIG[mode].collectsDisplayName ? (
            <label>
              Display name
              <input
                name="displayName"
                autoComplete="name"
                maxLength={100}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+84 901 234 567"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <p className={styles.help}>We will send a one-time code by SMS.</p>
          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={verifyCode}>
          <label>
            Verification code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              autoFocus
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? "Checking…" : AUTH_MODE_CONFIG[mode].verifyLabel}
          </button>
          <button
            type="button"
            className={styles.textButton}
            disabled={busy}
            onClick={() => {
              setStep("details");
              setCode("");
              setMessage("");
            }}
          >
            Change phone number
          </button>
        </form>
      )}

      <p className={styles.message} aria-live="polite">
        {message}
      </p>
    </aside>
  );
}
