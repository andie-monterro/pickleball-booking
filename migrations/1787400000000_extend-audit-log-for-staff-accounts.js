/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Onboarding and offboarding a front-desk person are staff actions like any
  // other, so they land in the Audit Log. Their details snapshot the account's
  // name and phone instead of a Booking.
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    `check (action in ('booking_created', 'booking_cancelled',
                      'staff_account_created', 'staff_account_deactivated'))`,
  );

  // Staff now manage the role themselves, so the bootstrap script only has to
  // create the first account.
  pgm.sql(`
    comment on table staff_accounts is
      'The staff role: one row grants venue-side powers to one Player record, so every staff action is attributable to an individual person. Staff grant and revoke the role in the app; scripts/grant-staff.mjs only bootstraps the first account, which cannot be created from behind the role itself. Offboarding deletes the row — the Audit Log, not this table, is the history of who held it.';
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // The narrower constraint would reject entries that are already there, so the
  // staff-account ones go first. Only a migration may do this: the append-only
  // trigger blocks every application path, so it is switched off around the
  // delete and straight back on.
  pgm.sql(`
    alter table audit_log_entries disable trigger audit_log_entries_append_only;
    delete from audit_log_entries
     where action in ('staff_account_created', 'staff_account_deactivated');
    alter table audit_log_entries enable trigger audit_log_entries_append_only;
  `);
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    "check (action in ('booking_created', 'booking_cancelled'))",
  );
  pgm.sql(`
    comment on table staff_accounts is
      'The staff role: one row grants venue-side powers to one Player record, so every staff action is attributable to an individual person. The first grant comes from bootstrap (scripts/grant-staff.mjs); managing grants in the app is a later slice.';
  `);
};
