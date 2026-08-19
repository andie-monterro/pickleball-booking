/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable("venue_settings", {
    id: { type: "integer", primaryKey: true },
    venue_time_zone: { type: "text", notNull: true },
    casual_horizon_days: { type: "integer", notNull: true },
    member_horizon_days: { type: "integer", notNull: true },
  });
  pgm.addConstraint("venue_settings", "venue_settings_singleton", "check (id = 1)");
  pgm.addConstraint("venue_settings", "venue_settings_horizons_positive", "check (casual_horizon_days > 0 and member_horizon_days >= casual_horizon_days)");

  pgm.createTable("opening_hours", {
    id: "id",
    day_of_week: { type: "integer", notNull: true },
    start_hour: { type: "integer", notNull: true },
    end_hour: { type: "integer", notNull: true },
  });
  pgm.addConstraint("opening_hours", "opening_hours_day_range", "check (day_of_week between 0 and 6)");
  pgm.addConstraint("opening_hours", "opening_hours_whole_hour_range", "check (start_hour between 0 and 23 and end_hour between 1 and 24 and start_hour < end_hour)");
  pgm.createIndex("opening_hours", ["day_of_week", "start_hour"], { unique: true });

  pgm.createTable("slot_claims", {
    id: "id",
    court_id: { type: "integer", notNull: true, references: "courts", onDelete: "cascade" },
    slot_starts_at: { type: "timestamptz", notNull: true },
    source_kind: { type: "text", notNull: true },
    source_id: { type: "text", notNull: true },
  });
  pgm.addConstraint("slot_claims", "slot_claims_source_kind", "check (source_kind in ('booking', 'block'))");
  pgm.createIndex("slot_claims", ["court_id", "slot_starts_at"], { unique: true });
  pgm.createIndex("slot_claims", ["source_kind", "source_id"]);
  pgm.sql(`
    comment on table slot_claims is
      'Slot-level occupancy invariant rows. Booking and Block domain records own source_id values in their slices; this table is not a Booking or Block record.';
  `);

  pgm.sql(`
    insert into courts (name)
    values ('Court 1'), ('Court 2'), ('Court 3'), ('Court 4')
    on conflict (name) do nothing;

    insert into venue_settings (id, venue_time_zone, casual_horizon_days, member_horizon_days)
    values (1, 'Asia/Ho_Chi_Minh', 7, 14);

    insert into opening_hours (day_of_week, start_hour, end_hour)
    values
      (0, 6, 22),
      (1, 6, 22),
      (2, 6, 22),
      (3, 6, 22),
      (4, 6, 22),
      (5, 6, 22),
      (6, 6, 22);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("slot_claims");
  pgm.dropTable("opening_hours");
  pgm.dropTable("venue_settings");
  pgm.sql("delete from courts where name in ('Court 1', 'Court 2', 'Court 3', 'Court 4')");
};
