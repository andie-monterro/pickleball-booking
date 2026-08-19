import { cookies } from "next/headers";
import { BookingGrid } from "@/components/booking-grid";
import { readAvailability } from "@/lib/availability";
import { SESSION_COOKIE_NAME, readPlayerSessionToken } from "@/lib/auth/auth";
import { readUpcomingBookings } from "@/lib/bookings";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<{ date?: string | string[] }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const date = typeof params?.date === "string" ? params.date : undefined;
  const cookieStore = await cookies();
  const player = await readPlayerSessionToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
  );
  const [availability, bookings] = await Promise.all([
    readAvailability(date, player?.id),
    player ? readUpcomingBookings(player.id) : [],
  ]);

  return (
    <main
      style={{
        boxSizing: "border-box",
        margin: "0 auto",
        maxWidth: "96rem",
        padding: "clamp(1.5rem, 4vw, 2rem)",
        width: "100%",
      }}
    >
      <BookingGrid
        availability={availability}
        bookings={bookings}
        signedIn={Boolean(player)}
      />
    </main>
  );
}