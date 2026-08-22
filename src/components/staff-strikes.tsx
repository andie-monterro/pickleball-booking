"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VENUE_TIME_ZONE } from "@/lib/clock";
import type { DeskPlayer } from "@/lib/staff/players";
import type { Strike, StrikeReason } from "@/lib/staff/strikes";
import styles from "./staff-strikes.module.css";

const VENUE_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const REASON_LABEL: Record<StrikeReason, string> = {
  late_cancel: "Late Cancel",
  no_show: "No-show",
};

const WAIVE_ERROR: Record<string, string> = {
  strike_already_waived: "That Strike is already waived.",
  strike_not_found: "That Strike is gone. Pick the Player again to see the current list.",
};

// A Player's Strikes are read on demand: the desk asks about one Player at a
// time, and the list changes under it as Strikes are earned and waived.
type StaffStrikesProps = {
  players: DeskPlayer[];
};

export function StaffStrikes({ players }: StaffStrikesProps) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(false);
  const [waivingId, setWaivingId] = useState<string>();
  const [error, setError] = useState<string>();

  const loadStrikes = async (id: string) => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/staff/strikes?playerId=${encodeURIComponent(id)}`,
      );
      if (!response.ok) {
        setStrikes([]);
        setError("The Strikes could not be read. Refresh the page and try again.");
        return;
      }
      const body = (await response.json()) as { strikes: Strike[] };
      setStrikes(body.strikes);
    } finally {
      setLoading(false);
    }
  };

  const choosePlayer = async (id: string) => {
    setPlayerId(id);
    setStrikes([]);
    if (id) {
      await loadStrikes(id);
    }
  };

  const waive = async (strikeId: string) => {
    setWaivingId(strikeId);
    setError(undefined);
    try {
      const response = await fetch("/api/staff/waivers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strikeId }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(
          WAIVE_ERROR[body.error ?? ""] ??
            "The Strike could not be waived. Refresh the page and try again.",
        );
      }
      await loadStrikes(playerId);
      // The Audit Log on this page gains the waiver entry.
      router.refresh();
    } finally {
      setWaivingId(undefined);
    }
  };

  return (
    <section aria-labelledby="strikes-heading" className={styles.strikes}>
      <h3 id="strikes-heading">Strikes and waivers</h3>
      <p className={styles.hint}>
        A waived Strike stays on the Player&apos;s record and stops counting
        toward a Booking Ban. A ban that only stood because of that Strike ends
        with the waiver. Waiving cannot be undone.
      </p>
      <label className={styles.field}>
        Player
        <select
          onChange={(event) => choosePlayer(event.target.value)}
          value={playerId}
        >
          <option value="">Pick a Player</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.displayName} — {player.phone}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {playerId && !loading && strikes.length === 0 && (
        <p>This Player has no Strikes.</p>
      )}
      {loading && <p>Reading the Strikes…</p>}
      {strikes.length > 0 && (
        <ul className={styles.strikeList}>
          {strikes.map((strike) => (
            <li key={strike.id}>
              <span>
                <strong>{REASON_LABEL[strike.reason]}</strong> earned{" "}
                {VENUE_DATE_TIME.format(new Date(strike.earnedAt))} —{" "}
                {strike.courtName},{" "}
                {VENUE_DATE_TIME.format(new Date(strike.startsAt))}
              </span>
              {strike.waivedAt ? (
                <span className={styles.waived}>
                  Waived {VENUE_DATE_TIME.format(new Date(strike.waivedAt))}
                </span>
              ) : (
                <button
                  aria-label={`Waive the ${
                    REASON_LABEL[strike.reason]
                  } Strike earned ${VENUE_DATE_TIME.format(
                    new Date(strike.earnedAt),
                  )}`}
                  className={styles.secondaryButton}
                  disabled={waivingId !== undefined}
                  onClick={() => waive(strike.id)}
                  type="button"
                >
                  {waivingId === strike.id ? "Waiving…" : "Waive Strike"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
