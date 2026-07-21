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
import { getLang } from "@/lib/i18n/server";

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

// Заголовок намеренно НЕ повторяет официальное имя завода: иначе в поиске
// система конкурирует с rempassvagon.uz и её принимают за сайт завода.
// По «tyvqtz» находится, по «Ташкентский вагонный завод» — не путается.
// noindex не ставим: сотрудники должны находить систему поиском.
export function generateMetadata(): Metadata {
  const lang = getLang();
  const ru = lang === "ru";
  const title = ru ? "TYVQTZ — внутренняя система" : "TYVQTZ — ichki tizim";
  const description = ru
    ? "Внутренняя система учёта сборки вагонов. Только для сотрудников завода. О заводе: rempassvagon.uz"
    : "Vagon yig‘ishni hisobga olish ichki tizimi. Faqat zavod xodimlari uchun. Zavod haqida: rempassvagon.uz";
  return {
    // без metadataBase og:image уходит относительным путём и Telegram/соцсети
    // его не подхватывают — нужен абсолютный URL
    metadataBase: new URL("https://tyvqtzuz.vercel.app"),
    title,
    description,
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
          <Notifications position="top-right" />
          <I18nProvider initialLang={lang}>
            <ModalsProvider>{children}</ModalsProvider>
          </I18nProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
