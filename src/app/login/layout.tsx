import type { Metadata } from "next";
import { getLang } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";

// Слой существует только ради метаданных: сама страница входа — клиентский
// компонент ("use client"), а из такого нельзя экспортировать metadata.
//
// Своё описание странице нужно потому, что именно её видит поиск: «/»
// редиректит на /login, и в выдачу попадает этот адрес, а не корень.
export function generateMetadata(): Metadata {
  const ru = getLang() === "ru";
  return {
    title: ru ? "Вход в систему — TYVQTZ" : "Tizimga kirish — TYVQTZ",
    description: ru
      ? "Вход в внутреннюю систему Ташкентского вагонного завода. Учётные записи выдаются на заводе, регистрация закрыта. Официальный сайт завода: rempassvagon.uz"
      : "Toshkent vagon zavodining ichki tizimiga kirish. Hisob yozuvlari zavodda beriladi, ro‘yxatdan o‘tish yopiq. Zavod rasmiy sayti: rempassvagon.uz",
    alternates: { canonical: "/login" },
  };
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ru = getLang() === "ru";
  const factory = ru
    ? "АО «Ташкентский завод по строительству и ремонту пассажирских вагонов»"
    : "«Toshkent yo‘lovchi vagonlarini qurish va ta’mirlash zavodi» AJ";

  // Разметка для поиска: говорим Google, что TYVQTZ — это приложение, а не
  // сайт завода, и что завод — отдельная организация со своим адресом.
  // Так по имени завода находятся оба, но подменой одного другим это не
  // выглядит. Тип WebApplication выбран сознательно вместо Organization:
  // организация здесь — завод, а не система.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "TYVQTZ",
    url: siteUrl(),
    applicationCategory: "BusinessApplication",
    inLanguage: ["uz", "ru"],
    browserRequirements: ru
      ? "Требуется учётная запись, выданная на заводе"
      : "Zavod bergan hisob yozuvi talab qilinadi",
    publisher: {
      "@type": "Organization",
      name: factory,
      url: "https://www.rempassvagon.uz",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Данные полностью наши, из констант выше — пользовательского ввода
        // здесь нет, поэтому вставка безопасна.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
