/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable("staff_accounts", {
    player_id: {
      type: "text",
      primaryKey: true,
      references: "players",
      onDelete: "cascade",
    },
    granted_at: { type: "timestamptz", notNull: true },
  });
  pgm.sql(`
    comment on table staff_accounts is
      'The staff role: one row grants venue-side powers to one Player record, so every staff action is attributable to an individual person. The first grant comes from bootstrap (scripts/grant-staff.mjs); managing grants in the app is a later slice.';
  `);

  // The Audit Log carries no foreign keys on purpose: it is a historical record
  // that must outlive the rows it describes, and a foreign key would let a
  // deleted Player either erase an entry or block the deletion. Ids are kept for
  // joining when the records still exist; the snapshot columns and details keep
  // an entry readable on its own.
  pgm.createTable("audit_log_entries", {
    id: { type: "text", primaryKey: true },
    staff_id: { type: "text", notNull: true },
    staff_display_name: { type: "text", notNull: true },
    action: { type: "text", notNull: true },
    booking_id: { type: "text" },
    subject_player_id: { type: "text" },
    details: { type: "jsonb", notNull: true },
    occurred_at: { type: "timestamptz", notNull: true },
  });
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    "check (action in ('booking_created', 'booking_cancelled'))",
  );
  pgm.createIndex("audit_log_entries", ["occurred_at", "id"]);

  // Append-only, enforced by the database: the log exists so disputes stay
  // resolvable, so no application bug may rewrite or erase an entry.
  pgm.sql(`
    create function audit_log_entries_stay_append_only() returns trigger
    language plpgsql as $$
    begin
      raise exception 'audit_log_entries is append-only';
    end;
    $$;

    create trigger audit_log_entries_append_only
      before update or delete on audit_log_entries
      for each row execute function audit_log_entries_stay_append_only();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql("drop trigger audit_log_entries_append_only on audit_log_entries");
  pgm.sql("drop function audit_log_entries_stay_append_only()");
  pgm.dropTable("audit_log_entries");
  pgm.dropTable("staff_accounts");
};
