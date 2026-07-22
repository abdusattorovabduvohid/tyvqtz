"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMediaQuery } from "@mantine/hooks";
import {
  Button,
  PasswordInput,
  TextInput,
  Title,
  Text,
  Stack,
  Box,
  Anchor,
  Group,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconLock, IconUser, IconInfoCircle, IconExternalLink } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";

// плавающие цветные пятна (aurora)
const BLOBS = [
  { color: "#3a6fcc", size: 560, top: "-12%", left: "-8%", dur: 16 },
  { color: "#22a7e0", size: 460, top: "45%", left: "60%", dur: 20 },
  { color: "#1c4288", size: 620, top: "60%", left: "-10%", dur: 24 },
  { color: "#4dabf7", size: 380, top: "-6%", left: "62%", dur: 18 },
];

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  // Тяжёлые анимации (4 пятна с blur 90px + плавающий логотип) на телефоне
  // насыщают GPU-композитор, и ввод в поля начинает лагать. На узких экранах
  // отдаём статичный градиент. getInitialValueInEffect:false + значение по
  // умолчанию false => до определения экрана считаем «мобильным» и анимации
  // не рисуем (лучше без анимаций, чем лаг при вводе).
  const isDesktop = useMediaQuery("(min-width: 48em)", false, {
    getInitialValueInEffect: false,
  });

  const form = useForm({
    initialValues: { login: "", password: "" },
    validate: {
      login: (v) => (v.trim().length < 1 ? t("login.enterLogin") : null),
      password: (v) => (v.length < 1 ? t("login.enterPassword") : null),
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      notifications.show({
        color: "teal",
        title: t("login.welcome"),
        message: t("login.success"),
      });
      const from = params.get("from") || "/dashboard";
      router.replace(from);
      router.refresh();
    } catch (e: any) {
      notifications.show({
        color: "red",
        title: t("login.error"),
        message: e.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background:
          "radial-gradient(1200px 800px at 20% 10%, #16346b 0%, #0d1a38 45%, #081124 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* aurora пятна — только на десктопе: на телефоне blur 90px + бесконечная
          анимация лагают ввод. Мобильный получает статичный градиент фона. */}
      {isDesktop &&
        BLOBS.map((b, i) => (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: b.size,
              height: b.size,
              top: b.top,
              left: b.left,
              borderRadius: "50%",
              background: b.color,
              filter: "blur(90px)",
              opacity: 0.55,
            }}
            animate={{
              x: [0, 40, -20, 0],
              y: [0, -30, 25, 0],
              scale: [1, 1.12, 0.95, 1],
            }}
            transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

      {/* тонкая сетка поверх */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(circle at 50% 40%, black 0%, transparent 75%)",
        }}
      />

      <Box style={{ position: "absolute", top: 20, right: 20, zIndex: 3 }}>
        <LanguageSwitcher onDark />
      </Box>

      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: "100%", maxWidth: 440, zIndex: 2 }}
      >
        <Box
          style={{
            background: "rgba(255,255,255,0.94)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.5)",
            borderRadius: 22,
            padding: "40px 34px",
            boxShadow:
              "0 30px 70px rgba(3,12,32,0.5), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        >
          <Stack align="center" gap={6} mb="lg">
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 160, damping: 14 }}
            >
              <motion.div
                animate={isDesktop ? { y: [0, -5, 0] } : undefined}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ filter: "drop-shadow(0 12px 26px rgba(27,42,126,0.35))" }}
              >
                <Logo height={104} />
              </motion.div>
            </motion.div>

            <Text
              fw={700}
              size="xs"
              tt="uppercase"
              mt="sm"
              style={{ letterSpacing: 2, color: "#2f66c9" }}
            >
              O‘zbekiston temir yo‘llari
            </Text>
            <Title
              order={3}
              ta="center"
              style={{ lineHeight: 1.25, color: "#122c5c", maxWidth: 360 }}
            >
              {t("brand.title")}
            </Title>
            <Text c="dimmed" size="sm" ta="center" mt={2}>
              {t("login.subtitle")}
            </Text>
          </Stack>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label={t("login.login")}
                placeholder="admin"
                leftSection={<IconUser size={18} />}
                size="md"
                radius="md"
                {...form.getInputProps("login")}
              />
              <PasswordInput
                label={t("login.password")}
                placeholder={t("login.passwordPlaceholder")}
                leftSection={<IconLock size={18} />}
                size="md"
                radius="md"
                {...form.getInputProps("password")}
              />
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  type="submit"
                  size="md"
                  fullWidth
                  mt={4}
                  radius="md"
                  loading={loading}
                  variant="gradient"
                  gradient={{ from: "#2f66c9", to: "#22a7e0", deg: 45 }}
                >
                  {t("login.submit")}
                </Button>
              </motion.div>
            </Stack>
          </form>

          {/* Пояснение для случайного посетителя: это не сайт завода */}
          <Box
            mt="xl"
            p="sm"
            style={{
              borderRadius: 12,
              background: "rgba(47,102,201,0.045)",
              border: "1px solid rgba(47,102,201,0.13)",
            }}
          >
            <Group gap={6} mb={5} wrap="nowrap">
              <IconInfoCircle size={14} color="#2f66c9" />
              <Text size="xs" fw={700} c="#122c5c">
                {t("login.notice.title")}
              </Text>
            </Group>
            <Text size="11.5px" c="dimmed" lh={1.55}>
              {t("login.notice.body")}
            </Text>
            <Anchor
              href="https://www.rempassvagon.uz/uz"
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              fw={700}
              mt={7}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              rempassvagon.uz
              <IconExternalLink size={11} />
            </Anchor>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
