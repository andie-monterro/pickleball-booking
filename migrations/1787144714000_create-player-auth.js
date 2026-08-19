/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable("players", {
    id: { type: "text", primaryKey: true },
    display_name: { type: "text", notNull: true },
    phone: { type: "text", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true },
  });
  pgm.addConstraint(
    "players",
    "players_display_name_not_blank",
    "check (length(trim(display_name)) between 1 and 100)",
  );

  pgm.createTable("player_signups", {
    player_id: {
      type: "text",
      primaryKey: true,
      references: "players",
      onDelete: "cascade",
    },
    completed_at: { type: "timestamptz", notNull: true },
  });

  pgm.createTable("auth_challenges", {
    id: { type: "text", primaryKey: true },
    flow: { type: "text", notNull: true },
    phone: { type: "text", notNull: true },
    display_name: { type: "text" },
    expires_at: { type: "timestamptz", notNull: true },
    consumed_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true },
  });
  pgm.addConstraint(
    "auth_challenges",
    "auth_challenges_flow",
    "check (flow in ('signup', 'sign_in'))",
  );
  pgm.addConstraint(
    "auth_challenges",
    "auth_challenges_signup_name",
    "check ((flow = 'signup' and display_name is not null) or (flow = 'sign_in' and display_name is null))",
  );
  pgm.createIndex("auth_challenges", "expires_at");

  pgm.createTable("player_sessions", {
    token_hash: { type: "text", primaryKey: true },
    player_id: {
      type: "text",
      notNull: true,
      references: "players",
      onDelete: "cascade",
    },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true },
  });
  pgm.createIndex("player_sessions", "player_id");
  pgm.createIndex("player_sessions", "expires_at");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("player_sessions");
  pgm.dropTable("auth_challenges");
  pgm.dropTable("player_signups");
  pgm.dropTable("players");
};
