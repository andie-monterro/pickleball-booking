import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, readPlayerSessionToken } from "@/lib/auth/auth";
import { clock, formatVenueTime, VENUE_TIME_ZONE } from "@/lib/clock";
import { SignInLink } from "./sign-in-link";
import styles from "./app-header.module.css";

export async function AppHeader() {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const player = await readPlayerSessionToken(sessionToken);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a className={styles.venue} href="/">
          <h1>Pickleball Booking</h1>
          <p>
            Times use {VENUE_TIME_ZONE}. Current venue time is {formatVenueTime(clock.now())}.
          </p>
        </a>
        <div className={styles.playerArea}>
          <span className={styles.strikeSlot} data-slot="strike-count" />
          {player ? <strong className={styles.playerName}>{player.displayName}</strong> : <SignInLink />}
        </div>
      </div>
    </header>
  );
}
