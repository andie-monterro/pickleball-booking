/**
 * Venue settings that are data, not code. Currently the Booking Horizon per
 * player standing: 14 days for Members, 7 days for Casual players (defaults).
 * A single row, so the settings read never has to pick between rows.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable("venue_settings", {
    id: { type: "integer", primaryKey: true, default: 1 },
    member_horizon_days: { type: "integer", notNull: true },
    casual_horizon_days: { type: "integer", notNull: true },
  });

  pgm.addConstraint("venue_settings", "venue_settings_hold_a_single_row", {
    check: "id = 1",
  });
  pgm.addConstraint("venue_settings", "venue_settings_horizons_are_ordered", {
    check: "casual_horizon_days > 0 and member_horizon_days >= casual_horizon_days",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("venue_settings");
};
