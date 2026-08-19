import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "Pickleball Booking",
  description: "Court booking for the venue",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ color: "#101828", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
