"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { apiFetch, showError } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";

// цветные пятна фона (aurora)
const BLOBS = [
  { color: "#3a6fcc", size: 560, top: "-12%", left: "-8%" },
  { color: "#22a7e0", size: 460, top: "45%", left: "60%" },
  { color: "#1c4288", size: 620, top: "60%", left: "-10%" },
  { color: "#4dabf7", size: 380, top: "-6%", left: "62%" },
];

// Координаты для журнала входов.
//
// Браузер спрашивает разрешение у человека, и отказ — штатный исход: тогда
// вход идёт как обычно, а в журнале останется только город по IP.
// Ждём не дольше 6 секунд: вход не должен зависеть от того, поймал ли
// телефон спутники в заводском цеху.
async function currentPosition(): Promise<{
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return {};
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          gpsLat: pos.coords.latitude,
          gpsLng: pos.coords.longitude,
          gpsAccuracy: pos.coords.accuracy,
        }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 }
    );
  });
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

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
      const res = await apiFetch<{ siteOff?: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ ...values, ...(await currentPosition()) }),
      });

      // Систему выключил суперадмин. Пароль был верный, сессия выдана, но
      // работать пока не с чем — ведём на заглушку с объяснением, а не
      // приветствуем и не бросаем в дашборд, откуда всё равно выкинет.
      if (res?.siteOff) {
        router.replace("/offline");
        router.refresh();
        return;
      }

      notifications.show({
        color: "teal",
        title: t("login.welcome"),
        message: t("login.success"),
      });
      const from = params.get("from") || "/dashboard";
      router.replace(from);
      router.refresh();
    } catch (e) {
      showError(e, t("login.error"));
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
      {/* aurora-пятна — СТАТИЧНЫЕ, без анимации. Бесконечная анимация 4 больших
          blur-слоёв держит GPU-композитор занятым, и на каждый кадр ввода печать
          в поля лагала — и на телефоне, и на компьютере. Статичные пятна
          растеризуются один раз, красоту фона сохраняют, лага нет. */}
      {BLOBS.map((b, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            borderRadius: "50%",
            background: b.color,
            filter: "blur(70px)",
            opacity: 0.45,
            pointerEvents: "none",
          }}
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

      <div
        className="reveal-up"
        style={{ width: "100%", maxWidth: 440, zIndex: 2 }}
      >
        <Box
          style={{
            // Без backdrop-filter: карта стоит над движущимися blur-пятнами, и
            // размытие фона пересчитывалось на КАЖДЫЙ кадр ввода — из-за этого
            // печать в поля лагала и на компьютере. Карта и так почти
            // непрозрачная, поэтому визуально ничего не теряем.
            background: "#ffffff",
            border: "1px solid rgba(255,255,255,0.5)",
            borderRadius: 22,
            padding: "40px 34px",
            boxShadow:
              "0 30px 70px rgba(3,12,32,0.5), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        >
          <Stack align="center" gap={6} mb="lg">
            {/* логотип статичный, без «плавания» — бесконечная анимация тоже
                нагружала композитор и добавляла лаг при вводе */}
            <div style={{ filter: "drop-shadow(0 12px 26px rgba(27,42,126,0.35))" }}>
              <Logo height={104} />
            </div>

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
              <Button
                type="submit"
                size="md"
                fullWidth
                mt={4}
                radius="md"
                loading={loading}
                variant="gradient"
                gradient={{ from: "#2f66c9", to: "#22a7e0", deg: 45 }}
                className="tap"
              >
                {t("login.submit")}
              </Button>
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
      </div>
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
