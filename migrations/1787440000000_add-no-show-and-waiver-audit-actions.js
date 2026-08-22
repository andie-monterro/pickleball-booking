/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Marking a No-show, undoing that mark, and waiving a Strike are staff
  // judgements, so each lands in the Audit Log. A waiver entry snapshots the
  // Strike — its reason, when it was earned, and whose it is — instead of a
  // Booking or a Staff account.
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    `check (action in ('booking_created', 'booking_cancelled',
                      'block_placed', 'block_removed',
                      'staff_account_created', 'staff_account_deactivated',
                      'no_show_marked', 'no_show_undone', 'strike_waived'))`,
  );

  // The mark is the Strike: one strikes row with reason 'no_show', carrying the
  // Booking it is about. There is no second record of "this Booking is a
  // No-show", so a mark can never exist without its Strike, and undoing the
  // mark is deleting that row. The unique index on booking_id already allows
  // one Strike per Booking, which is what "one mark, one Strike" means.
  pgm.sql(`
    comment on table strikes is
      'A mark against a Player for a Late Cancel or a No-show, counting toward a Booking Ban for 90 days from earned_at unless waived. A No-show mark is itself the row: Staff marking a started Booking inserts it with reason ''no_show'', and undoing the mark deletes it. waived_at set means Staff waived the Strike, so it stops counting; who did either is in the Audit Log.';
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // The narrower constraint would reject entries that are already there, so the
  // No-show and waiver ones go first. Only a migration may delete from the log:
  // the append-only trigger blocks every application path, so it is switched
  // off around the delete and straight back on.
  pgm.sql(`
    alter table audit_log_entries disable trigger audit_log_entries_append_only;
    delete from audit_log_entries
     where action in ('no_show_marked', 'no_show_undone', 'strike_waived');
    alter table audit_log_entries enable trigger audit_log_entries_append_only;
  `);
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    `check (action in ('booking_created', 'booking_cancelled',
                      'block_placed', 'block_removed',
                      'staff_account_created', 'staff_account_deactivated'))`,
  );
  pgm.sql("comment on table strikes is null");
};
