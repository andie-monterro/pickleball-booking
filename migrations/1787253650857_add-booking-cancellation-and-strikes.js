/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createType("booking_cancellation_kind", [
    "penalty_free",
    "late_cancel",
  ]);
  pgm.addColumns("bookings", {
    cancelled_at: { type: "timestamptz" },
    cancellation_kind: { type: "booking_cancellation_kind" },
  });
  pgm.addConstraint(
    "bookings",
    "bookings_cancellation_fields_together",
    "check ((cancelled_at is null) = (cancellation_kind is null))",
  );

  pgm.createType("strike_reason", ["late_cancel", "no_show"]);
  pgm.createTable("strikes", {
    id: { type: "text", primaryKey: true },
    player_id: {
      type: "text",
      notNull: true,
      references: "players",
      onDelete: "restrict",
    },
    booking_id: {
      type: "text",
      notNull: true,
      references: "bookings",
      onDelete: "restrict",
    },
    reason: { type: "strike_reason", notNull: true },
    earned_at: { type: "timestamptz", notNull: true },
    waived_at: { type: "timestamptz" },
  });
  pgm.createIndex("strikes", "booking_id", { unique: true });
  pgm.createIndex("strikes", ["player_id", "earned_at"]);
  pgm.sql(`
    create function current_strike_count(target_player_id text, as_of timestamptz)
    returns integer
    language sql
    stable
    strict
    as $$
      select count(*)::integer
        from strikes
       where player_id = target_player_id
         and waived_at is null
         and earned_at >= as_of - interval '90 days'
    $$;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql("drop function current_strike_count(text, timestamptz)");
  pgm.dropTable("strikes");
  pgm.dropType("strike_reason");
  pgm.dropConstraint("bookings", "bookings_cancellation_fields_together");
  pgm.dropColumns("bookings", ["cancelled_at", "cancellation_kind"]);
  pgm.dropType("booking_cancellation_kind");
};
