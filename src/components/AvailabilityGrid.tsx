import type { Availability, Occupancy, Slot } from "@/lib/availability";

const OCCUPANCY_LABELS: Record<Occupancy, string> = {
  free: "Free",
  taken: "Taken",
  blocked: "Blocked",
  outside_horizon: "Not bookable",
};

const OCCUPANCY_COLOURS: Record<Occupancy, string> = {
  free: "#dcfce7",
  taken: "#fee2e2",
  blocked: "#e5e7eb",
  outside_horizon: "#f8fafc",
};

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function slotIndex(slots: Slot[]): Map<string, Slot> {
  const index = new Map<string, Slot>();
  for (const slot of slots) {
    index.set(`${slot.courtId}@${slot.hour}`, slot);
  }
  return index;
}

const CELL_STYLE = {
  border: "1px solid #cbd5e1",
  padding: "0.5rem",
  minWidth: "6rem",
  textAlign: "center",
} as const;

export function AvailabilityGrid({
  availability,
}: {
  availability: Availability;
}) {
  const { courts, hours, slots } = availability;

  if (courts.length === 0 || hours.length === 0) {
    return <p>The venue is closed on this day.</p>;
  }

  const byCourtAndHour = slotIndex(slots);

  return (
    <>
      {/* Horizontal scroll keeps every court reachable on a phone. */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            minWidth: `${6 + courts.length * 6}rem`,
          }}
        >
          <caption style={{ captionSide: "top", textAlign: "left" }}>
            Court availability on {availability.date}
          </caption>
          <thead>
            <tr>
              <th scope="col" style={CELL_STYLE}>
                Hour
              </th>
              {courts.map((court) => (
                <th key={court.id} scope="col" style={CELL_STYLE}>
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <th scope="row" style={CELL_STYLE}>
                  {hourLabel(hour)}
                </th>
                {courts.map((court) => {
                  const slot = byCourtAndHour.get(`${court.id}@${hour}`);
                  const occupancy: Occupancy = slot
                    ? slot.occupancy
                    : "outside_horizon";
                  return (
                    <td
                      key={court.id}
                      style={{
                        ...CELL_STYLE,
                        background: OCCUPANCY_COLOURS[occupancy],
                      }}
                    >
                      {OCCUPANCY_LABELS[occupancy]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: "0.875rem" }}>
        &quot;Not bookable&quot; means the hour has passed, or the day is not
        open for booking yet.
      </p>
    </>
  );
}
