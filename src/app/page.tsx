import { readAvailability, type SlotStatus } from "@/lib/availability";

const STATUS_COLOR: Record<SlotStatus, string> = {
  free: "#ecfdf3",
  taken: "#fee4e2",
  blocked: "#e4e7ec",
  outside_horizon: "#eff4ff",
};


type HomePageProps = {
  searchParams?: Promise<{ date?: string | string[] }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const date = typeof params?.date === "string" ? params.date : undefined;
  const availability = await readAvailability(date);
  const slotByHourAndCourt = new Map(
    availability.slots.map((slot) => [`${slot.hour}|${slot.courtId}`, slot]),
  );

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Pickleball Booking</h1>
      <p>Public court availability. No sign-in is needed.</p>

      <nav aria-label="Choose a day" style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "1rem" }}>
        {availability.days.map((day) => (
          <a
            key={day.date}
            href={`/?date=${day.date}`}
            style={{
              border: day.date === availability.date ? "2px solid #175cd3" : "1px solid #d0d5dd",
              borderRadius: "0.75rem",
              color: "inherit",
              minWidth: "9rem",
              padding: "0.75rem",
              textDecoration: "none",
            }}
          >
            <strong>{day.date}</strong>
            <br />
            {day.memberOnly ? `Member-only. Opens ${day.opensToEveryoneOn}.` : "Open to everyone."}
          </a>
        ))}
      </nav>

      <section aria-label={`Availability for ${availability.date}`} style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "48rem", width: "100%" }}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Time</th>
              {availability.courts.map((court) => (
                <th key={court.id} style={courtHeaderCellStyle}>{court.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {availability.hours.map((hour) => (
              <tr key={hour}>
                <th style={headerCellStyle}>{hour}</th>
                {availability.courts.map((court) => {
                  const slot = slotByHourAndCourt.get(`${hour}|${court.id}`);
                  return (
                    <td
                      key={court.id}
                      style={{
                        background: slot ? STATUS_COLOR[slot.status] : "#ffffff",
                        border: "1px solid #d0d5dd",
                        padding: "0.75rem",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {slot ? slot.label : "Closed"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const headerCellStyle = {
  background: "#f9fafb",
  border: "1px solid #d0d5dd",
  padding: "0.75rem",
  position: "sticky",
  left: 0,
  whiteSpace: "nowrap",
} as const;


const courtHeaderCellStyle = {
  ...headerCellStyle,
  left: "auto",
  minWidth: "10rem",
} as const;