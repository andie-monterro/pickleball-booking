/**
 * Opening Hours: the venue's bookable window per day of week, aligned to whole
 * hours. Slots exist only inside Opening Hours. A missing row means the venue
 * is closed that day of week.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable("opening_hours", {
    // 0 = Sunday ... 6 = Saturday, matching JavaScript's day numbering.
    day_of_week: { type: "smallint", primaryKey: true },
    opens_hour: { type: "smallint", notNull: true },
    closes_hour: { type: "smallint", notNull: true },
  });

  pgm.addConstraint("opening_hours", "opening_hours_day_of_week_is_a_weekday", {
    check: "day_of_week between 0 and 6",
  });
  pgm.addConstraint("opening_hours", "opening_hours_are_whole_hours_in_order", {
    check: "opens_hour between 0 and 23 and closes_hour between 1 and 24 and closes_hour > opens_hour",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("opening_hours");
};
