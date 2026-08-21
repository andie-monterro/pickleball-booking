"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VENUE_TIME_ZONE } from "@/lib/clock";
import type { StaffAccount } from "@/lib/staff/accounts";
import styles from "./staff-accounts.module.css";

const VENUE_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIME_ZONE,
  dateStyle: "medium",
});

const CREATE_ERROR: Record<string, string> = {
  staff_account_exists: "That phone number already has a Staff account.",
  invalid_phone: "Enter the phone number as +84… with no spaces.",
  invalid_display_name:
    "This phone number is new here, so type the person's name as well.",
};

const DEACTIVATE_ERROR: Record<string, string> = {
  last_staff_account:
    "This is the only Staff account left. Create another one first, so the desk keeps a way in.",
  staff_account_not_found:
    "That Staff account is already gone. Refresh the page to see the current list.",
};

type StaffAccountsProps = {
  accounts: StaffAccount[];
  signedInStaffId: string;
};

export function StaffAccounts({ accounts, signedInStaffId }: StaffAccountsProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [pendingRemoval, setPendingRemoval] = useState<string>();
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string>();

  const readError = async (
    response: Response,
    messages: Record<string, string>,
    fallback: string,
  ): Promise<string> => {
    const body = (await response.json()) as { error?: string };
    return messages[body.error ?? ""] ?? fallback;
  };

  const createAccount = async () => {
    setCreating(true);
    setCreateError(undefined);
    try {
      const response = await fetch("/api/staff/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone,
          ...(name.trim() === "" ? {} : { displayName: name }),
        }),
      });
      if (!response.ok) {
        setCreateError(
          await readError(
            response,
            CREATE_ERROR,
            "The Staff account could not be created. Check the details and try again.",
          ),
        );
        return;
      }
      setName("");
      setPhone("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const deactivateAccount = async (playerId: string) => {
    setDeactivating(true);
    setDeactivateError(undefined);
    try {
      const response = await fetch("/api/staff/accounts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!response.ok) {
        setDeactivateError(
          await readError(
            response,
            DEACTIVATE_ERROR,
            "The Staff account could not be deactivated. Refresh the page and try again.",
          ),
        );
        return;
      }
      setPendingRemoval(undefined);
      router.refresh();
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <section aria-labelledby="staff-accounts-heading" className={styles.accounts}>
      <h3 id="staff-accounts-heading">Staff accounts</h3>
      <p className={styles.hint}>
        Everyone listed here has the full desk powers, including this list. A new
        account signs in with their phone number and a one-time code.
      </p>

      <ul className={styles.accountList}>
        {accounts.map((account) => (
          <li key={account.id}>
            <span>
              <strong>{account.displayName}</strong>
              {account.id === signedInStaffId ? " (you)" : ""}
              <br />
              <span className={styles.hint}>
                {account.phone} — staff since{" "}
                {VENUE_DATE.format(new Date(account.grantedAt))}
              </span>
            </span>
            {pendingRemoval === account.id ? (
              <span className={styles.rowActions}>
                <button
                  className={styles.secondaryButton}
                  disabled={deactivating}
                  onClick={() => setPendingRemoval(undefined)}
                  type="button"
                >
                  Keep
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={deactivating}
                  onClick={() => deactivateAccount(account.id)}
                  type="button"
                >
                  {deactivating ? "Deactivating…" : "Yes, deactivate"}
                </button>
              </span>
            ) : (
              <button
                aria-label={`Deactivate the Staff account of ${account.displayName}`}
                className={styles.secondaryButton}
                onClick={() => {
                  setDeactivateError(undefined);
                  setPendingRemoval(account.id);
                }}
                type="button"
              >
                Deactivate
              </button>
            )}
          </li>
        ))}
      </ul>
      {pendingRemoval && (
        <p className={styles.hint}>
          Deactivating removes the desk powers only. The person keeps their Player
          record, their Bookings, and their name on every past Audit Log entry.
        </p>
      )}
      {deactivateError && (
        <p className={styles.error} role="alert">
          {deactivateError}
        </p>
      )}

      <div className={styles.newAccount}>
        <h4>Onboard a front-desk person</h4>
        <label className={styles.field}>
          Phone
          <input
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+84901234567"
            value={phone}
          />
        </label>
        <label className={styles.field}>
          Name
          <input
            onChange={(event) => setName(event.target.value)}
            placeholder="Mai Tran"
            value={name}
          />
        </label>
        <p className={styles.hint}>
          The name is only used when this phone number is new. A number the app
          already knows keeps its own Player record, its name, and its history.
        </p>
        {createError && (
          <p className={styles.error} role="alert">
            {createError}
          </p>
        )}
        <button
          className={styles.primaryButton}
          disabled={creating || phone.trim() === ""}
          onClick={createAccount}
          type="button"
        >
          {creating ? "Creating…" : "Create Staff account"}
        </button>
      </div>
    </section>
  );
}
