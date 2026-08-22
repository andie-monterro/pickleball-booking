import { cookies } from "next/headers";
import { AuditLogFeed } from "@/components/audit-log-feed";
import { StaffAccounts } from "@/components/staff-accounts";
import { StaffDesk } from "@/components/staff-desk";
import { StaffStrikes } from "@/components/staff-strikes";
import { readAuditLog } from "@/lib/audit-log";
import { SESSION_COOKIE_NAME, readPlayerSessionToken } from "@/lib/auth/auth";
import { readStaffAccounts } from "@/lib/staff/accounts";
import { readDeskPlayers } from "@/lib/staff/players";
import { readStaffSchedule } from "@/lib/staff/schedule";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type StaffPageProps = {
  searchParams?: Promise<{ date?: string | string[] }>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = await searchParams;
  const date = typeof params?.date === "string" ? params.date : undefined;
  const cookieStore = await cookies();
  const staff = await readPlayerSessionToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
  );

  // Nothing about a Booker reaches this page unless a Staff session asked for
  // it: the guard runs before any read.
  if (!staff || staff.role !== "staff") {
    return (
      <main className={styles.main}>
        <h2>Staff desk</h2>
        {staff ? (
          <p className={styles.notice}>
            This page is for Staff. Ask the venue to grant your account the
            staff role.
          </p>
        ) : (
          <p className={styles.notice}>
            <a href={`/sign-in?returnTo=${encodeURIComponent("/staff")}`}>Sign in</a>{" "}
            with your Staff account to open the desk.
          </p>
        )}
      </main>
    );
  }

  const [schedule, players, accounts, auditEntries] = await Promise.all([
    readStaffSchedule(date),
    readDeskPlayers(),
    readStaffAccounts(),
    readAuditLog(),
  ]);

  return (
    <main className={styles.main}>
      <StaffDesk
        players={players}
        schedule={schedule}
        staffName={staff.displayName}
      />
      <StaffStrikes players={players} />
      <StaffAccounts accounts={accounts} signedInStaffId={staff.id} />
      <AuditLogFeed entries={auditEntries} />
    </main>
  );
}
