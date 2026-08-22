"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DeskPlayer } from "@/lib/staff/players";
import styles from "./staff-memberships.module.css";

const MEMBERSHIP_ERROR: Record<string, string> = {
  player_not_found: "That Player record no longer exists. Refresh the page.",
  invalid_request: "Give the date as YYYY-MM-DD, for example 2026-12-31.",
};

// Memberships are sold at the venue; the app only recognizes the date. The desk
// therefore types one date per Player and nothing else.
type StaffMembershipsProps = {
  players: DeskPlayer[];
};

export function StaffMemberships({ players }: StaffMembershipsProps) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [memberUntil, setMemberUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  const chosen = players.find((player) => player.id === playerId);

  const choosePlayer = (id: string) => {
    setPlayerId(id);
    setError(undefined);
    setSaved(undefined);
    setMemberUntil(players.find((player) => player.id === id)?.memberUntil ?? "");
  };

  const save = async (value: string | null) => {
    setSaving(true);
    setError(undefined);
    setSaved(undefined);
    try {
      const response = await fetch("/api/staff/memberships", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, memberUntil: value }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(
          MEMBERSHIP_ERROR[body.error ?? ""] ??
            "The membership could not be changed. Refresh the page and try again.",
        );
        return;
      }
      setMemberUntil(value ?? "");
      setSaved(
        value === null
          ? "Membership cleared. This Player is a casual player again."
          : `Saved. This Player is a Member for the whole of ${value}.`,
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="memberships-heading" className={styles.memberships}>
      <h3 id="memberships-heading">Membership dates</h3>
      <p className={styles.hint}>
        The date is the last day of the membership. The Player is a Member for
        the whole of that day, and a casual player from the next venue day. A
        Member books further ahead; nothing else changes.
      </p>
      <label className={styles.field}>
        Player
        <select onChange={(event) => choosePlayer(event.target.value)} value={playerId}>
          <option value="">Pick a Player</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.displayName} — {player.phone}
              {player.memberUntil ? ` — member until ${player.memberUntil}` : ""}
            </option>
          ))}
        </select>
      </label>
      {chosen && (
        <>
          <label className={styles.field}>
            Member until
            <input
              aria-label={`Member until date for ${chosen.displayName}`}
              onChange={(event) => setMemberUntil(event.target.value)}
              placeholder="2026-12-31"
              type="date"
              value={memberUntil}
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {saved && !error && <p className={styles.hint}>{saved}</p>}
          <span className={styles.rowActions}>
            <button
              className={styles.primaryButton}
              disabled={saving || memberUntil === ""}
              onClick={() => save(memberUntil)}
              type="button"
            >
              {saving ? "Saving…" : "Save the date"}
            </button>
            <button
              className={styles.secondaryButton}
              disabled={saving || chosen.memberUntil === null}
              onClick={() => save(null)}
              type="button"
            >
              Clear the membership
            </button>
          </span>
        </>
      )}
    </section>
  );
}
