import Link from "next/link";
import { Box, Button, Card, Container, Grid, Group, Stack, Text, Title } from "@mantine/core";
import {
  IconClipboardCheck,
  IconExternalLink,
  IconListNumbers,
  IconLock,
  IconUsers,
} from "@tabler/icons-react";
import { Logo } from "@/components/Logo";

// Публичная главная страница.
//
// Раньше «/» просто редиректил на /login, и для поиска сайт состоял из одной
// формы входа на 49 слов — ранжировать было нечего. Здесь лежит настоящий
// текст: что это за система, чья она и кому выдают доступ.
//
// Текст намеренно честный: это внутренняя система, а не сайт завода. Задача
// страницы — чтобы по запросу «tyvqtz» сотрудник находил систему и сразу
// понимал, туда он попал или ему нужен rempassvagon.uz.
//
// Двуязычие сделано прямо здесь, а не через словарь: страница одна, ключей
// понадобилось бы три десятка, и они бы больше нигде не использовались.

const FACTORY_UZ = "«Toshkent yo‘lovchi vagonlarini qurish va ta’mirlash zavodi» AJ";
const FACTORY_RU = "АО «Ташкентский завод по строительству и ремонту пассажирских вагонов»";

export function HomeLanding({ ru }: { ru: boolean }) {
  // Разметка для поиска: говорим, что TYVQTZ — приложение завода, а сам
  // завод — отдельная организация со своим сайтом. Так по имени завода
  // находятся оба, но система не выдаёт себя за официальный сайт.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "TYVQTZ",
    alternateName: ru ? FACTORY_RU : FACTORY_UZ,
    url: "https://tyvqtz.uz",
    applicationCategory: "BusinessApplication",
    inLanguage: ["uz", "ru"],
    description: ru
      ? "Внутренняя система учёта сборки и ремонта пассажирских вагонов. Доступ только для сотрудников завода."
      : "Yo‘lovchi vagonlarini yig‘ish va ta’mirlash hisobining ichki tizimi. Kirish faqat zavod xodimlari uchun.",
    publisher: {
      "@type": "Organization",
      name: ru ? FACTORY_RU : FACTORY_UZ,
      alternateName: "TYVQTZ",
      url: "https://www.rempassvagon.uz",
      address: {
        "@type": "PostalAddress",
        addressLocality: ru ? "Ташкент" : "Toshkent",
        addressCountry: "UZ",
      },
    },
  };

  const features = ru
    ? [
        {
          icon: <IconListNumbers size={22} />,
          title: "Этапы сборки",
          text: "Позиции из бумажного плана — по дням, с нормативом времени, бригадой и цехом. Видно, где вагон стоит прямо сейчас.",
        },
        {
          icon: <IconClipboardCheck size={22} />,
          title: "Приёмка по дням",
          text: "Ответственные подписывают каждый рабочий день позиции. День принят, когда расписались все назначенные.",
        },
        {
          icon: <IconUsers size={22} />,
          title: "Люди и доступы",
          text: "Роли с точной настройкой прав: кто что видит и кто что может менять. Учётные записи выдаются на заводе.",
        },
      ]
    : [
        {
          icon: <IconListNumbers size={22} />,
          title: "Yig‘ish bosqichlari",
          text: "Qog‘oz rejadagi pozitsiyalar — kunlar bo‘yicha, vaqt normasi, brigada va sex bilan. Vagon hozir qayerdaligi ko‘rinib turadi.",
        },
        {
          icon: <IconClipboardCheck size={22} />,
          title: "Kunlik qabul",
          text: "Mas’ullar pozitsiyaning har bir ish kunini imzolaydi. Barcha tayinlanganlar imzolagach, kun qabul qilinadi.",
        },
        {
          icon: <IconUsers size={22} />,
          title: "Xodimlar va ruxsatlar",
          text: "Rollar aniq sozlanadi: kim nimani ko‘radi, kim nimani o‘zgartira oladi. Hisob yozuvlari zavodda beriladi.",
        },
      ];

  return (
    <Box
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 800px at 20% 0%, #16346b 0%, #0d1a38 45%, #081124 100%)",
      }}
    >
      <script
        type="application/ld+json"
        // Данные из констант выше, пользовательского ввода здесь нет.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Container size="lg" py={{ base: 40, sm: 64 }}>
        <Stack gap={48}>
          {/* ── Шапка ── */}
          <Stack align="center" gap="md">
            <Box style={{ filter: "drop-shadow(0 12px 26px rgba(27,42,126,0.45))" }}>
              <Logo height={96} />
            </Box>
            <Text
              fw={700}
              size="xs"
              tt="uppercase"
              style={{ letterSpacing: 2, color: "#8ab4f8" }}
            >
              {ru ? "Узбекистон темир йуллари" : "O‘zbekiston temir yo‘llari"}
            </Text>
            <Title
              order={1}
              ta="center"
              style={{ color: "#fff", fontSize: "clamp(26px, 4vw, 40px)", lineHeight: 1.2, maxWidth: 820 }}
            >
              TYVQTZ — {ru ? "внутренняя система учёта" : "ichki hisob tizimi"}
            </Title>
            <Text ta="center" style={{ color: "#b9c9e6", maxWidth: 640, lineHeight: 1.65 }}>
              {ru ? FACTORY_RU : FACTORY_UZ}
              {ru
                ? " ведёт в этой системе сборку и ремонт пассажирских вагонов: этапы, сроки, приёмку работ и ответственных."
                : " shu tizimda yo‘lovchi vagonlarini yig‘ish va ta’mirlashni yuritadi: bosqichlar, muddatlar, ishlarni qabul qilish va mas’ullar."}
            </Text>
            <Button
              component={Link}
              href="/login"
              size="md"
              radius="md"
              mt="xs"
              leftSection={<IconLock size={18} />}
              variant="gradient"
              gradient={{ from: "#2f66c9", to: "#22a7e0", deg: 45 }}
            >
              {ru ? "Войти в систему" : "Tizimga kirish"}
            </Button>
          </Stack>

          {/* ── Что делает система ── */}
          <Grid gutter="md">
            {features.map((f) => (
              <Grid.Col key={f.title} span={{ base: 12, sm: 4 }}>
                <Card
                  radius="lg"
                  padding="lg"
                  h="100%"
                  style={{
                    background: "rgba(255,255,255,0.055)",
                    border: "1px solid rgba(255,255,255,0.11)",
                  }}
                >
                  <Box style={{ color: "#8ab4f8" }}>{f.icon}</Box>
                  <Text fw={700} c="#fff" mt="sm" mb={6}>
                    {f.title}
                  </Text>
                  <Text size="sm" style={{ color: "#a9bcdb", lineHeight: 1.6 }}>
                    {f.text}
                  </Text>
                </Card>
              </Grid.Col>
            ))}
          </Grid>

          {/* ── Кому доступ ── */}
          <Card
            radius="lg"
            padding="xl"
            style={{
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.11)",
            }}
          >
            <Title order={2} style={{ color: "#fff", fontSize: 21 }}>
              {ru ? "Кому открыт доступ" : "Kimga ruxsat beriladi"}
            </Title>
            <Text size="sm" mt="sm" style={{ color: "#a9bcdb", lineHeight: 1.7, maxWidth: 760 }}>
              {ru
                ? "Только сотрудникам завода: мастерам, начальникам цехов, приёмщикам и администрации. Регистрация закрыта — логин и пароль выдаёт администратор системы на заводе. Если учётной записи нет, обратитесь к своему начальнику цеха."
                : "Faqat zavod xodimlariga: ustalar, sex boshliqlari, qabul qiluvchilar va ma’muriyatga. Ro‘yxatdan o‘tish yopiq — login va parolni zavoddagi tizim administratori beradi. Hisob yozuvingiz bo‘lmasa, sex boshlig‘ingizga murojaat qiling."}
            </Text>
          </Card>

          {/* ── Развилка: это не сайт завода ── */}
          <Card
            radius="lg"
            padding="xl"
            style={{
              background: "rgba(47,102,201,0.14)",
              border: "1px solid rgba(138,180,248,0.3)",
            }}
          >
            <Title order={2} style={{ color: "#fff", fontSize: 21 }}>
              {ru ? "Ищете информацию о заводе?" : "Zavod haqida ma’lumot qidiryapsizmi?"}
            </Title>
            <Text size="sm" mt="sm" style={{ color: "#c3d3ee", lineHeight: 1.7, maxWidth: 760 }}>
              {ru
                ? "Это рабочая система для сотрудников, а не официальный сайт предприятия. Продукция, контакты, вакансии и новости завода — на официальном сайте:"
                : "Bu — xodimlar uchun ishchi tizim, korxonaning rasmiy sayti emas. Zavod mahsulotlari, aloqa ma’lumotlari, bo‘sh ish o‘rinlari va yangiliklari rasmiy saytda:"}
            </Text>
            <Button
              component="a"
              href="https://www.rempassvagon.uz/uz"
              target="_blank"
              rel="noopener noreferrer"
              variant="white"
              size="sm"
              radius="md"
              mt="md"
              rightSection={<IconExternalLink size={15} />}
            >
              rempassvagon.uz
            </Button>
          </Card>

          <Group justify="center">
            <Text size="xs" ta="center" style={{ color: "#6d82a8" }}>
              © 2026 · {ru ? FACTORY_RU : FACTORY_UZ}
            </Text>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
