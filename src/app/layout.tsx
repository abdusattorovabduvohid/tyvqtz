import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { theme } from "./theme";
import { I18nProvider } from "@/components/I18nProvider";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { PwaResumeGuard } from "@/components/PwaResumeGuard";
import { getLang } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";

// PWA: цвет системной строки в установленном приложении.
//
// viewport-fit=cover нужен, чтобы работал env(safe-area-inset-*). Без него
// эти переменные всегда равны 0. Раньше cover стоял БЕЗ отступа по
// safe-area — шапка уезжала под системную строку iPhone, и тап по бургеру
// перехватывала система (в Safari браузерная обвязка это скрывала, поэтому
// баг проявлялся только в установленном приложении). Тогда убрали cover;
// правильное решение — cover ПЛЮС отступ, он задан в globals.css.
//
// Зум намеренно НЕ блокируем (maximum-scale): сотрудники увеличивают фото
// вагонов, и это же требование доступности. Автозум полей решён в globals.css
// через font-size: 16px.
export const viewport: Viewport = {
  themeColor: "#2f66c9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Раньше заголовок намеренно НЕ повторял имя завода, чтобы система не
// конкурировала с rempassvagon.uz. Решение отменено владельцем: имя завода
// теперь в заголовке — по запросу «Ташкентский вагонный завод» система тоже
// должна находиться. От путаницы защищает не пустой заголовок, а блок
// «Это внутренняя система завода» на самой странице входа со ссылкой на
// официальный сайт (login.notice.* в translations.ts).
//
// Заголовок держим короче ~60 знаков — Google обрезает длиннее; полное
// официальное имя вынесено в description, там места больше.
export function generateMetadata(): Metadata {
  const lang = getLang();
  const ru = lang === "ru";
  const title = ru
    ? "TYVQTZ — внутренняя система Ташкентского вагонного завода"
    : "TYVQTZ — Toshkent vagon zavodi ichki tizimi";
  const description = ru
    ? "Внутренняя система учёта сборки и ремонта вагонов АО «Ташкентский завод по строительству и ремонту пассажирских вагонов». Вход только для сотрудников. Официальный сайт завода: rempassvagon.uz"
    : "«Toshkent yo‘lovchi vagonlarini qurish va ta’mirlash zavodi» AJ ichki tizimi: vagon yig‘ish va ta’mirlash hisobi. Kirish faqat xodimlar uchun. Zavod rasmiy sayti: rempassvagon.uz";
  return {
    // без metadataBase og:image уходит относительным путём и Telegram/соцсети
    // его не подхватывают — нужен абсолютный URL.
    // Адрес берём из окружения: при переезде на .uz меняется только APP_URL.
    metadataBase: new URL(siteUrl()),
    title,
    description,
    // Явный canonical склеивает для Google старый vercel.app-адрес и новый
    // домен в одну страницу — иначе они конкурируют друг с другом в выдаче.
    alternates: { canonical: "/" },
    keywords: ru
      ? ["TYVQTZ", "Ташкентский вагонный завод", "пассажирские вагоны", "внутренняя система"]
      : ["TYVQTZ", "Toshkent vagon zavodi", "yo‘lovchi vagonlari", "ichki tizim"],
    openGraph: {
      title,
      description,
      siteName: "TYVQTZ",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "TYVQTZ" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
    // iOS не читает manifest.webmanifest — установку на «Экран Домой»
    // он настраивает через эти мета-теги и apple-touch-icon.
    appleWebApp: {
      capable: true,
      title: "TYVQTZ",
      statusBarStyle: "default",
    },
    // Next из appleWebApp.capable отдаёт только apple-mobile-web-app-capable,
    // а Chrome считает его устаревшим и пишет предупреждение в консоль.
    // Стандартный тег нужен Android; Apple-вариант оставляем — iOS знает
    // только его. Нужны оба.
    other: {
      "mobile-web-app-capable": "yes",
    },
    icons: {
      icon: "/icon.svg",
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = getLang();
  return (
    <html lang={lang} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <ServiceWorkerRegistrar />
          <PwaResumeGuard />
          <Notifications position="top-right" />
          <I18nProvider initialLang={lang}>
            <ModalsProvider>{children}</ModalsProvider>
          </I18nProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
