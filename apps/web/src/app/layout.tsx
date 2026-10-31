import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { AppStateProvider } from "@/components/AppState";
import "./globals.css";

export const metadata: Metadata = {
  title: "BaraWatch Kalteng",
  description: "Pantauan karhutla Kalimantan Tengah",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <AppStateProvider>
          <AppHeader />
          {children}
        </AppStateProvider>
      </body>
    </html>
  );
}
