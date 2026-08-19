import Link from "next/link";
import type { DayStripEntry } from "@/lib/availability";
import { venueDayOfWeek, type VenueDate } from "@/lib/venue-time";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(date: VenueDate, today: VenueDate): string {
  if (date === today) {
    return "Today";
  }
  return `${WEEKDAY_NAMES[venueDayOfWeek(date)]} ${date.slice(8)}`;
}

export function DayStrip({
  days,
  selectedDate,
  today,
}: {
  days: DayStripEntry[];
  selectedDate: VenueDate;
  today: VenueDate;
}) {
  return (
    <nav aria-label="Choose a day">
      <ul
        style={{
          display: "flex",
          gap: "0.5rem",
          margin: 0,
          padding: "0 0 0.5rem",
          listStyle: "none",
          overflowX: "auto",
        }}
      >
        {days.map((day) => {
          const selected = day.date === selectedDate;
          return (
            <li key={day.date} style={{ flex: "0 0 auto" }}>
              <Link
                href={`/?date=${day.date}`}
                aria-current={selected ? "page" : undefined}
                style={{
                  display: "block",
                  minWidth: "5.5rem",
                  padding: "0.5rem",
                  border: "1px solid #999",
                  borderRadius: "0.5rem",
                  background: selected ? "#e0e7ff" : "#fff",
                  color: "inherit",
                  textDecoration: "none",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                <span style={{ display: "block" }}>
                  {dayLabel(day.date, today)}
                </span>
                <span style={{ display: "block", fontSize: "0.75rem" }}>
                  {day.memberOnly
                    ? `Members only. Opens to everyone on ${day.opensToAllOn}.`
                    : day.date}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
