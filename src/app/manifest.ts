import type { MetadataRoute } from "next";

/** Home-screen install info (name, colours, icons) for iPhone and Android. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tokyo Trip Planner",
    short_name: "Trip Planner",
    description: "แพลนทริปโตเกียวกับแก๊งเพื่อน — ตารางเที่ยว หารค่าใช้จ่าย เช็กลิสต์",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
