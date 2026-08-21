/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Two slices built at the same time each rewrote this constraint from the
  // shape it had on main, so each knew only its own action names: the Blocks
  // migration dropped the staff-account ones, and the staff-accounts migration,
  // running later, dropped the Block ones. Neither branch conflicted in git —
  // they touch different files — so the loss is only visible once both are
  // applied. Restate the constraint with every action name the code can write.
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    `check (action in ('booking_created', 'booking_cancelled',
                      'block_placed', 'block_removed',
                      'staff_account_created', 'staff_account_deactivated'))`,
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Going back reinstates the narrower set the staff-accounts migration left,
  // so entries it would reject go first. Only a migration may delete from the
  // log: the append-only trigger blocks every application path, so it is
  // switched off around the delete and straight back on.
  pgm.sql(`
    alter table audit_log_entries disable trigger audit_log_entries_append_only;
    delete from audit_log_entries
     where action in ('block_placed', 'block_removed');
    alter table audit_log_entries enable trigger audit_log_entries_append_only;
  `);
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    `check (action in ('booking_created', 'booking_cancelled',
                      'staff_account_created', 'staff_account_deactivated'))`,
  );
};
