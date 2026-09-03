import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Next отдаёт это как /robots.txt.
//
// Индексировать разрешаем только «витрину» — корень и страницу входа: по
// запросу «tyvqtz» сотрудник должен находить систему. Всё остальное закрыто:
// /dashboard и /api и так за авторизацией, но без явного запрета Google
// тратит на них обход и потом показывает в консоли ошибки редиректов.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login"],
      disallow: ["/dashboard", "/api", "/uploads"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
