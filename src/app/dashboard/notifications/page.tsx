"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Group,
  Text,
  Button,
  Center,
  Loader,
  Stack,
  Badge,
  Alert,
  Box,
  Switch,
  CopyButton,
  Code,
  ThemeIcon,
  Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBell,
  IconBrandTelegram,
  IconDeviceMobile,
  IconAlertTriangle,
  IconCheck,
  IconSend,
} from "@tabler/icons-react";
import { apiFetch, showError } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useI18n } from "@/components/I18nProvider";
import {
  pushSupported,
  isIosWithoutPwa,
  currentSubscription,
  subscribePush,
  unsubscribePush,
} from "@/lib/push-client";

interface Settings {
  push: {
    enabled: boolean;
    publicKey: string | null;
    devices: { id: string; endpoint: string; userAgent: string | null; createdAt: string }[];
  };
  telegram: {
    enabled: boolean;
    botUsername: string | null;
    linked: boolean;
    username: string | null;
  };
}

// «Chrome · Windows» из user-agent — чтобы человек узнал своё устройство
function deviceLabel(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Brauzer";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iPhone"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac/.test(ua)
          ? "Mac"
          : "";
  return os ? `${browser} · ${os}` : browser;
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [tgCode, setTgCode] = useState<string | null>(null);

  const supported = pushSupported();
  const iosHint = isIosWithoutPwa();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<Settings>("/api/notifications/settings");
      setData(r);
      const sub = await currentSubscription();
      // подписка считается активной, только если сервер о ней знает
      setSubscribed(
        Boolean(sub && r.push.devices.some((d) => d.endpoint === sub.endpoint))
      );
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Человек уходит в телеграм и возвращается на вкладку — подтягиваем статус,
  // чтобы он сразу увидел «подключено», а не жал F5.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  async function togglePush(on: boolean) {
    if (!data?.push.publicKey) {
      notifications.show({ color: "red", message: t("notif.pushOff") });
      return;
    }
    setBusy("push");
    try {
      if (on) {
        const sub = await subscribePush(data.push.publicKey);
        await apiFetch("/api/push/subscribe", {
          method: "POST",
          body: JSON.stringify(sub.toJSON()),
        });
        setSubscribed(true);
        notifications.show({ color: "teal", message: t("notif.pushOn") });
      } else {
        const endpoint = await unsubscribePush();
        if (endpoint) {
          await apiFetch("/api/push/subscribe", {
            method: "DELETE",
            body: JSON.stringify({ endpoint }),
          });
        }
        setSubscribed(false);
        notifications.show({ color: "gray", message: t("notif.pushOffDone") });
      }
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  async function linkTelegram() {
    setBusy("tg");
    try {
      const r = await apiFetch<{ code: string; link: string | null }>(
        "/api/notifications/telegram",
        { method: "POST" }
      );
      setTgCode(r.code);
      setTgLink(r.link);
      if (r.link) window.open(r.link, "_blank");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  async function unlinkTelegram() {
    setBusy("tg");
    try {
      await apiFetch("/api/notifications/telegram", { method: "DELETE" });
      setTgCode(null);
      setTgLink(null);
      notifications.show({ color: "gray", message: t("notif.tgUnlinked") });
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    try {
      await apiFetch("/api/push/test", { method: "POST" });
      notifications.show({ color: "teal", message: t("notif.testSent") });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Page>
        <PageHeader title={t("notif.title")} subtitle={t("notif.subtitle")} />
        <Center py={60}>
          <Loader />
        </Center>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title={t("notif.title")} subtitle={t("notif.subtitle")} />

      <Stack gap="lg">
        {/* ── Браузер / телефон ── */}
        <Card>
          <Group justify="space-between" wrap="wrap" gap="sm" mb="xs">
            <Group gap="sm">
              <ThemeIcon variant="light" color="steel" radius="md" size={38}>
                <IconBell size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600}>{t("notif.pushTitle")}</Text>
                <Text size="xs" c="dimmed">
                  {t("notif.pushHint")}
                </Text>
              </div>
            </Group>
            <Switch
              size="lg"
              checked={subscribed}
              disabled={!supported || !data?.push.enabled || busy === "push"}
              onChange={(e) => togglePush(e.currentTarget.checked)}
            />
          </Group>

          {!data?.push.enabled && (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm">{t("notif.pushOff")}</Text>
            </Alert>
          )}

          {!supported && (
            <Alert color="gray" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm">{t("notif.unsupported")}</Text>
            </Alert>
          )}

          {iosHint && (
            <Alert color="blue" variant="light" icon={<IconDeviceMobile size={16} />}>
              <Text size="sm">{t("notif.iosHint")}</Text>
            </Alert>
          )}

          {!!data?.push.devices.length && (
            <>
              <Divider my="sm" label={t("notif.devices")} labelPosition="left" />
              <Stack gap={6}>
                {data.push.devices.map((d) => (
                  <Group key={d.id} gap="xs" justify="space-between" wrap="nowrap">
                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                      <IconDeviceMobile size={15} color="var(--mantine-color-gray-6)" />
                      <Text size="sm" truncate>
                        {deviceLabel(d.userAgent)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </>
          )}
        </Card>

        {/* ── Телеграм ── */}
        <Card>
          <Group justify="space-between" wrap="wrap" gap="sm" mb="xs">
            <Group gap="sm">
              <ThemeIcon variant="light" color="blue" radius="md" size={38}>
                <IconBrandTelegram size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Telegram</Text>
                <Text size="xs" c="dimmed">
                  {t("notif.tgHint")}
                </Text>
              </div>
            </Group>
            {data?.telegram.linked ? (
              <Badge color="teal" variant="light" leftSection={<IconCheck size={12} />}>
                {data.telegram.username || t("notif.tgLinked")}
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                {t("notif.tgNotLinked")}
              </Badge>
            )}
          </Group>

          {!data?.telegram.enabled ? (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm">{t("notif.tgOff")}</Text>
            </Alert>
          ) : data.telegram.linked ? (
            <Button
              variant="light"
              color="red"
              size="xs"
              loading={busy === "tg"}
              onClick={unlinkTelegram}
            >
              {t("notif.tgUnlink")}
            </Button>
          ) : (
            <Stack gap="sm">
              <Button
                leftSection={<IconBrandTelegram size={16} />}
                loading={busy === "tg"}
                onClick={linkTelegram}
              >
                {t("notif.tgLink")}
              </Button>

              {tgCode && (
                <Box
                  p="sm"
                  style={{
                    borderRadius: 10,
                    background: "var(--mantine-color-gray-0)",
                    border: "1px solid var(--mantine-color-gray-2)",
                  }}
                >
                  <Text size="sm" mb={6}>
                    {t("notif.tgManual")}
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    <Code>/start {tgCode}</Code>
                    <CopyButton value={`/start ${tgCode}`}>
                      {({ copied, copy }) => (
                        <Button size="compact-xs" variant="light" onClick={copy}>
                          {copied ? t("common.copied") : t("common.copy")}
                        </Button>
                      )}
                    </CopyButton>
                    {tgLink && (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        component="a"
                        href={tgLink}
                        target="_blank"
                      >
                        {t("notif.tgOpenBot")}
                      </Button>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" mt={6}>
                    {t("notif.tgAfter")}
                  </Text>
                </Box>
              )}
            </Stack>
          )}
        </Card>

        {/* ── Проверка ── */}
        <Card>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <div>
              <Text fw={600}>{t("notif.testTitle")}</Text>
              <Text size="xs" c="dimmed">
                {t("notif.testHint")}
              </Text>
            </div>
            <Button
              variant="light"
              leftSection={<IconSend size={16} />}
              loading={busy === "test"}
              onClick={sendTest}
            >
              {t("notif.testBtn")}
            </Button>
          </Group>
        </Card>
      </Stack>
    </Page>
  );
}
