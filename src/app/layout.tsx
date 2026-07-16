import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dropzone/styles.css";
import "./globals.css";

import type { Metadata } from "next";
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { theme } from "./theme";
import { I18nProvider } from "@/components/I18nProvider";
import { getLang } from "@/lib/i18n/server";

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
    title,
    description,
    openGraph: { title, description, siteName: "TYVQTZ", type: "website" },
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
          <Notifications position="top-right" />
          <I18nProvider initialLang={lang}>
            <ModalsProvider>{children}</ModalsProvider>
          </I18nProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
