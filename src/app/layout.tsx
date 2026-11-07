import type { Metadata, Viewport } from "next";
import { Geist_Mono, Prompt } from "next/font/google";
import "./globals.css";

// Prompt isn't a variable font, so the weights used by the UI are listed explicitly.
const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tokyo Winter Trip 🗼❄️",
  description: "แพลนทริปโตเกียวกับแก๊งเพื่อน — ตารางเที่ยว หารค่าใช้จ่าย เช็กลิสต์",
  // "Add to Home Screen" on iPhone opens it full screen like an app.
  appleWebApp: { capable: true, title: "Trip Planner", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch/home indicator; safe-area insets are padded in CSS.
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${prompt.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
