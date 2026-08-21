#!/usr/bin/env node
// Bootstrap for the staff role.
//
// Staff create and deactivate Staff accounts in the app (/staff), so this script
// is only for the first account: the desk page is itself behind the staff role,
// so the first grant has to come from outside. It also stays the way back in if
// every account is somehow lost. It grants the role to a phone number, creates
// the Player record if the phone is new, and marks it as signed up so the person
// can sign in with a one-time code straight away.
//
// Usage:
//   DATABASE_URL=... node scripts/grant-staff.mjs +84901234567 "Desk One"
//   DATABASE_URL=... node scripts/grant-staff.mjs --revoke +84901234567
//
// The name is required only when the phone number is new.

import { randomUUID } from "node:crypto";
import { Client } from "pg";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const revoke = args[0] === "--revoke";
const [phoneArg, displayName] = revoke ? args.slice(1) : args;
const phone = phoneArg?.replace(/[\s()-]/g, "");

if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
  fail("Pass the phone number in international form, for example +84901234567.");
}
if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL is not set.");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("begin");
  const existing = await client.query(
    "select id, display_name from players where phone = $1",
    [phone],
  );
  let player = existing.rows[0];

  if (revoke) {
    if (!player) {
      fail(`No Player has the phone number ${phone}.`);
    }
    await client.query("delete from staff_accounts where player_id = $1", [player.id]);
    await client.query("commit");
    console.log(`Revoked the staff role from ${player.display_name} (${phone}).`);
  } else {
    if (!player) {
      if (!displayName?.trim()) {
        fail(`The phone number ${phone} is new, so pass a name as well.`);
      }
      const created = await client.query(
        `insert into players (id, display_name, phone, created_at)
         values ($1, $2, $3, now())
         returning id, display_name`,
        [randomUUID(), displayName.trim(), phone],
      );
      player = created.rows[0];
    }
    // A Staff account signs in rather than signing up, so the record counts as
    // signed up from the start. That also means a later self-signup with this
    // phone number cannot take the account over.
    await client.query(
      `insert into player_signups (player_id, completed_at)
       values ($1, now())
       on conflict (player_id) do nothing`,
      [player.id],
    );
    await client.query(
      `insert into staff_accounts (player_id, granted_at)
       values ($1, now())
       on conflict (player_id) do nothing`,
      [player.id],
    );
    await client.query("commit");
    console.log(`Granted the staff role to ${player.display_name} (${phone}).`);
  }
} catch (error) {
  await client.query("rollback");
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await client.end();
}
