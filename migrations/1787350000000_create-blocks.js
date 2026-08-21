/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // A Block is staff-made unavailability of one Court for a range of Slots. It
  // occupies Slots like a Booking — one slot_claims row per Slot, under the same
  // uniqueness constraint — but has no Booker and no policy semantics, so it
  // carries no player reference and no cancellation kind. A removed Block keeps
  // its row, because the Audit Log entry that describes it points at this id.
  pgm.createTable("blocks", {
    id: { type: "text", primaryKey: true },
    court_id: {
      type: "integer",
      notNull: true,
      references: "courts",
      onDelete: "restrict",
    },
    starts_at: { type: "timestamptz", notNull: true },
    slot_count: { type: "smallint", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
    removed_at: { type: "timestamptz" },
  });
  // Slots exist only inside one venue day's Opening Hours, so no Block can span
  // more than a day's worth of them. Longer maintenance is several Blocks.
  pgm.addConstraint(
    "blocks",
    "blocks_slot_count_range",
    "check (slot_count between 1 and 24)",
  );
  pgm.addConstraint(
    "blocks",
    "blocks_start_on_whole_hour",
    "check (date_trunc('hour', starts_at) = starts_at)",
  );
  pgm.createIndex("blocks", ["court_id", "starts_at"]);

  // Placing and removing a Block are staff actions, so they are audit-logged
  // like staff Bookings. A Block entry names no Player: it has no Booker.
  pgm.addColumns("audit_log_entries", { block_id: { type: "text" } });
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    "check (action in ('booking_created', 'booking_cancelled', 'block_placed', 'block_removed'))",
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropConstraint("audit_log_entries", "audit_log_entries_action");
  pgm.addConstraint(
    "audit_log_entries",
    "audit_log_entries_action",
    "check (action in ('booking_created', 'booking_cancelled'))",
  );
  pgm.dropColumns("audit_log_entries", ["block_id"]);
  pgm.dropTable("blocks");
};
