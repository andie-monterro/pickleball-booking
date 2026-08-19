/**
 * Slot claims: the stored occupancy of one Court for one Slot start. Slots
 * themselves are derived from Courts and Opening Hours and are never stored —
 * only claims on them are.
 *
 * A claim is made either by a Booking or by a Block. The primary key on
 * (court_id, starts_at) makes "no double-booking" a database invariant rather
 * than application logic. This table is the occupancy source the public
 * availability read model joins against; the tickets that create Bookings and
 * Blocks write their claims here.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable("slot_claims", {
    court_id: {
      type: "integer",
      notNull: true,
      references: "courts",
      onDelete: "CASCADE",
    },
    // The Slot start as an instant. Slots start on the hour in venue time.
    starts_at: { type: "timestamptz", notNull: true },
    kind: { type: "text", notNull: true },
  });

  pgm.addConstraint("slot_claims", "slot_claims_one_claim_per_slot", {
    primaryKey: ["court_id", "starts_at"],
  });
  pgm.addConstraint("slot_claims", "slot_claims_kind_is_known", {
    check: "kind in ('booking', 'block')",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("slot_claims");
};
