import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Next отдаёт это как /sitemap.xml.
//
// В карте ровно один адрес — /login. Это единственная страница сайта,
// которая отдаёт содержимое: «/» редиректит на неё, а всё остальное
// закрыто авторизацией.
//
// Раньше здесь стоял и «/». Это была ошибка: в карту сайта кладут адреса,
// которые отвечают 200, а «/» отвечает редиректом. Поисковик помечает
// такие строки как «страница с переадресацией» и тратит на них обход
// впустую — а в отчётах это выглядит как ошибка карты.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl()}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
