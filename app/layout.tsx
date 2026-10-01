import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const font = Noto_Sans_Thai({
  variable: "--font-sans-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "เฝ้าระวังน้ำท่วม นนทบุรี · Nonthaburi Flood Monitor",
  description: "ระดับน้ำและปริมาณฝนล่าสุดใกล้จังหวัดนนทบุรี / Latest river level and rainfall around Nonthaburi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${font.variable} h-full antialiased`}>
      <body className="h-dvh overflow-hidden">{children}</body>
    </html>
  );
}
