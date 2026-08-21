/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // A Booking Ban is derived at check time, never stored: it exists only as a
  // consequence of the Strike records, so waiving a Strike can undo the ban it
  // caused and nothing has to be kept in step by hand.
  //
  // A Strike triggers a ban when it is itself the third unwaived Strike inside
  // the 90 days ending at its own earned_at — that is what "a new Strike brings
  // the Player to 3" means. The ban it starts runs 14 days from that instant.
  // A Player is banned when at least one such ban has not run out yet, and the
  // one that ends last is the one to show them.
  pgm.sql(`
    create function booking_ban_ends_at(target_player_id text, as_of timestamptz)
    returns timestamptz
    language sql
    stable
    strict
    as $$
      select max(triggering.earned_at) + interval '14 days'
        from strikes as triggering
       where triggering.player_id = target_player_id
         and triggering.waived_at is null
         and triggering.earned_at <= as_of
         and triggering.earned_at + interval '14 days' > as_of
         and (
           select count(*)
             from strikes as counted
            where counted.player_id = triggering.player_id
              and counted.waived_at is null
              and counted.earned_at <= triggering.earned_at
              and counted.earned_at >= triggering.earned_at - interval '90 days'
         ) >= 3
    $$;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql("drop function booking_ban_ends_at(text, timestamptz)");
};
