"use client";

import { Box, Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconClipboardCheck,
  IconListNumbers,
  IconUsers,
} from "@tabler/icons-react";
import { useI18n } from "@/components/I18nProvider";

// Описание системы под формой входа.
//
// Зачем: сам экран входа — это 49 слов, и поисковику ранжировать нечего.
// По запросу «tyvqtz» конкурируют статьи gazeta.uz и railway.uz, и без
// текста система им не соперник. Отдельную посадочную страницу на «/»
// владелец отклонил — сотрудник должен видеть форму сразу, поэтому текст
// живёт здесь, ниже первого экрана: на вход он не влияет вообще.
//
// Блок серверного рендера не боится: Next отдаёт разметку клиентских
// компонентов в исходном HTML, поисковик читает её без выполнения скриптов.

const ACCENT = "#8ab4f8";
const BODY = "#a9bcdb";
const HAIRLINE = "rgba(138,180,248,0.16)";

export function LoginAbout() {
  const { t } = useI18n();

  const features = [
    { icon: IconListNumbers, key: "stages" },
    { icon: IconClipboardCheck, key: "signoff" },
    { icon: IconUsers, key: "people" },
  ] as const;

  return (
    <Box
      component="section"
      style={{
        // Внизу экрана входа фон ещё синий, а здесь он уже почти чёрный —
        // встык это читалось полосой. Верхние 340 пикселей гасим плавно,
        // и переход выглядит продолжением экрана, а не другим блоком.
        background: "linear-gradient(180deg, #10254a 0%, #081124 340px)",
        borderTop: `1px solid ${HAIRLINE}`,
      }}
    >
      {/* Отступ через clamp, а не через брейкпоинты: у Container проп py
          принимает одно значение, а плавный переход тут смотрится ровнее. */}
      <Container size="md" style={{ paddingBlock: "clamp(48px, 8vw, 76px)" }}>
        <Stack gap={48}>
          <Stack gap="xs" align="center" ta="center">
            <Text
              fw={700}
              size="xs"
              tt="uppercase"
              style={{ letterSpacing: 2.4, color: ACCENT }}
            >
              {t("about.eyebrow")}
            </Text>

            {/* Единственный h1 страницы: в карточке входа заголовок идёт
                третьим уровнем, верхний уровень был свободен. */}
            <Title
              order={1}
              style={{
                color: "#fff",
                fontSize: "clamp(21px, 3.2vw, 30px)",
                lineHeight: 1.3,
                maxWidth: 680,
                textWrap: "balance",
              }}
            >
              {t("about.title")}
            </Title>

            <Text mt={4} style={{ color: BODY, lineHeight: 1.7, maxWidth: 620 }}>
              {t("about.lead")}
            </Text>
          </Stack>

          {/* Тонкая линия сверху вместо рамки вокруг: три карточки в рамках
              на тёмном фоне выглядят тяжелее, чем весь остальной экран. */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={{ base: 28, sm: 32 }}>
            {features.map(({ icon: Icon, key }) => (
              <Box key={key} style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 18 }}>
                <Icon size={20} color={ACCENT} stroke={1.6} />
                <Text fw={600} c="#fff" mt={12} mb={6} fz="sm">
                  {t(`about.${key}.title`)}
                </Text>
                <Text fz="sm" style={{ color: BODY, lineHeight: 1.65 }}>
                  {t(`about.${key}.text`)}
                </Text>
              </Box>
            ))}
          </SimpleGrid>

          <Box
            style={{
              borderRadius: 14,
              padding: "22px 24px",
              background: "rgba(47,102,201,0.10)",
              border: `1px solid ${HAIRLINE}`,
            }}
          >
            <Text fw={600} c="#fff" fz="sm" mb={6}>
              {t("about.access.title")}
            </Text>
            <Text fz="sm" style={{ color: BODY, lineHeight: 1.7 }}>
              {t("about.access.text")}
            </Text>
          </Box>

          <Text fz="xs" ta="center" style={{ color: "#5f7398" }}>
            {t("shell.copyright")}
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
