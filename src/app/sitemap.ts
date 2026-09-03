import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Next отдаёт это как /sitemap.xml.
//
// В карте только публичные адреса. Остальные страницы за логином —
// добавлять их бессмысленно: робот получит редирект на /login.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];
}
