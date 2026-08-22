/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // A Court is never deleted: Bookings, Blocks and Audit Log entries all name
  // one, and the venue's own history is the reason the record has to stay.
  // Deactivating takes it out of the grid instead, and Staff can bring it back.
  pgm.addColumn("courts", {
    deactivated_at: { type: "timestamptz" },
  });
  pgm.sql(`
    comment on column courts.deactivated_at is
      'Set when Staff took the Court out of booking. A deactivated Court is not in the availability grid and cannot be claimed; null means it is bookable.';
  `);

  // Venue settings are data, not code, so Staff change them — and every change
  // is a staff action the Audit Log carries.
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    `check (action in ('booking_created', 'booking_cancelled',
                      'block_placed', 'block_removed',
                      'staff_account_created', 'staff_account_deactivated',
                      'no_show_marked', 'no_show_undone', 'strike_waived',
                      'court_added', 'court_renamed',
                      'court_deactivated', 'court_reactivated',
                      'opening_hours_changed', 'booking_horizons_changed',
                      'membership_changed'))`,
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // The narrower constraint would reject entries that are already there, so the
  // venue-settings ones go first. Only a migration may delete from the log: the
  // append-only trigger blocks every application path, so it is switched off
  // around the delete and straight back on.
  pgm.sql(`
    alter table audit_log_entries disable trigger audit_log_entries_append_only;
    delete from audit_log_entries
     where action in ('court_added', 'court_renamed',
                      'court_deactivated', 'court_reactivated',
                      'opening_hours_changed', 'booking_horizons_changed',
                      'membership_changed');
    alter table audit_log_entries enable trigger audit_log_entries_append_only;
  `);
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    `check (action in ('booking_created', 'booking_cancelled',
                      'block_placed', 'block_removed',
                      'staff_account_created', 'staff_account_deactivated',
                      'no_show_marked', 'no_show_undone', 'strike_waived'))`,
  );

  // A deactivated Court becomes bookable again, which is the only reading of
  // "this column never existed".
  pgm.dropColumn("courts", "deactivated_at");
};
