import type { Metadata, Viewport } from "next";
import { Anton, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });

export const metadata: Metadata = {
  title: "HeadPinz AV Control",
  description: "Put the right game on the right screens.",
  icons: { icon: "/brand/headpinz-logo-520.png" },
};
export const viewport: Viewport = { themeColor: "#0e1729", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${anton.variable}`}>
      <body>{children}</body>
    </html>
  );
}
