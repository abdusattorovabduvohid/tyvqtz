import type { MetadataRoute } from "next";

// Next автоматически отдаёт это как /manifest.webmanifest.
// Файл статический (без cookies/headers), иначе он станет динамическим
// роутом и браузер не сможет закешировать манифест.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TYVQTZ — ichki tizim",
    short_name: "TYVQTZ",
    description:
      "Vagon yig‘ishni hisobga olish ichki tizimi. Faqat zavod xodimlari uchun.",
    // "/" сам редиректит на /dashboard или /login в зависимости от сессии —
    // поэтому стартуем отсюда, а не с /dashboard (иначе разлогиненный
    // сотрудник открывает приложение и видит редирект-моргание).
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2f66c9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
