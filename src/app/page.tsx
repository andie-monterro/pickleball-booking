import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { DayStrip } from "@/components/DayStrip";
import { readAvailability } from "@/lib/availability";
import { isVenueDate } from "@/lib/venue-time";

// The grid reads the database and the current time on every request.
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const availability = await readAvailability({
    date: date !== undefined && isVenueDate(date) ? date : undefined,
  });

  return (
    <main style={{ padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem" }}>Court availability</h1>
      <p>Pick a day, then look for a free hour. You do not need to sign in.</p>
      <DayStrip
        days={availability.days}
        selectedDate={availability.date}
        today={availability.today}
      />
      <AvailabilityGrid availability={availability} />
    </main>
  );
}
