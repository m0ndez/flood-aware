import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const font = Noto_Sans_Thai({
  variable: "--font-sans-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "เฝ้าระวังน้ำท่วม ภาคกลาง–ตะวันออก · Flood Aware",
  description: "ระดับน้ำ ปริมาณฝน เรดาร์ และกล้อง ภาคกลางและภาคตะวันออก เริ่มจากนนทบุรี / River levels, rain, radar and cameras for Central and Eastern Thailand, starting with Nonthaburi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${font.variable} h-full antialiased`}>
      <body className="h-dvh overflow-hidden">{children}</body>
    </html>
  );
}
