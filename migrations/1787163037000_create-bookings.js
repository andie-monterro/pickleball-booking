/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable("bookings", {
    id: { type: "text", primaryKey: true },
    booker_id: {
      type: "text",
      notNull: true,
      references: "players",
      onDelete: "restrict",
    },
    court_id: {
      type: "integer",
      notNull: true,
      references: "courts",
      onDelete: "restrict",
    },
    starts_at: { type: "timestamptz", notNull: true },
    duration_hours: { type: "smallint", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
  });
  pgm.addConstraint(
    "bookings",
    "bookings_duration_hours",
    "check (duration_hours in (1, 2))",
  );
  pgm.addConstraint(
    "bookings",
    "bookings_start_on_whole_hour",
    "check (date_trunc('hour', starts_at) = starts_at)",
  );
  pgm.createIndex("bookings", ["booker_id", "starts_at"]);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("bookings");
};
