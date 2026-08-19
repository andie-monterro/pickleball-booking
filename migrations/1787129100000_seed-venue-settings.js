/**
 * Seed the venue's settings data: its Courts, its per-weekday Opening Hours,
 * and the Booking Horizon defaults. These are data, so the venue can change
 * them later without a code change.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

const SEEDED_COURT_NAMES = ["Court 1", "Court 2", "Court 3", "Court 4"];

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.sql(
    `insert into courts (name) values ${SEEDED_COURT_NAMES.map(
      (name) => `('${name}')`,
    ).join(", ")}`,
  );

  // The venue opens 06:00 and closes 22:00 every day of the week, so the last
  // Slot starts at 21:00.
  pgm.sql(
    `insert into opening_hours (day_of_week, opens_hour, closes_hour) values
       (0, 6, 22), (1, 6, 22), (2, 6, 22), (3, 6, 22),
       (4, 6, 22), (5, 6, 22), (6, 6, 22)`,
  );

  pgm.sql(
    `insert into venue_settings (id, member_horizon_days, casual_horizon_days)
       values (1, 14, 7)`,
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`delete from venue_settings where id = 1`);
  pgm.sql(`delete from opening_hours`);
  pgm.sql(
    `delete from courts where name in (${SEEDED_COURT_NAMES.map(
      (name) => `'${name}'`,
    ).join(", ")})`,
  );
};
