// Единственный источник правды об адресе сайта.
//
// При переезде на .uz-домен меняется ТОЛЬКО переменная APP_URL в настройках
// Vercel — ни один файл трогать не нужно. VERCEL_URL остаётся запасным
// вариантом для preview-деплоев, где APP_URL не задан.

/** Адрес из окружения. Пустая строка = адрес не настроен (локальная разработка). */
export function envSiteUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return raw.replace(/\/+$/, "");
}

// Запасной адрес для метаданных: metadataBase, sitemap и robots не принимают
// пустую строку, а собираются они в том числе локально, без APP_URL.
const FALLBACK_SITE_URL = "https://tyvqtz.vercel.app";

/** Канонический адрес для метаданных, sitemap.xml и robots.txt. Никогда не пустой. */
export function siteUrl(): string {
  return envSiteUrl() || FALLBACK_SITE_URL;
}
