"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AppShell,
  Burger,
  Group,
  Text,
  UnstyledButton,
  Avatar,
  Menu,
  rem,
  ThemeIcon,
  Box,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconUsers,
  IconShieldHalf,
  IconTrain,
  IconListNumbers,
  IconBox,
  IconLogout,
  IconChevronRight,
  IconLayoutDashboard,
  IconClipboardList,
  IconBuildingFactory2,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { UserProvider, type ClientUser } from "./UserContext";
import { useI18n } from "./I18nProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { pickName } from "@/lib/i18n/translations";

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <IconLayoutDashboard size={20} />,
  "my-stages": <IconClipboardList size={20} />,
  users: <IconUsers size={20} />,
  roles: <IconShieldHalf size={20} />,
  "wagon-types": <IconTrain size={20} />,
  stages: <IconListNumbers size={20} />,
  wagons: <IconBox size={20} />,
};

export interface NavItem {
  key: string;
  label: string;
  href: string;
}

export function DashboardShell({
  user,
  nav,
  children,
}: {
  user: ClientUser;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang } = useI18n();

  // ярлык пункта меню: фикс. пункты + секции по ключу
  const navLabel = (key: string) => {
    if (key === "dashboard") return t("shell.home");
    if (key === "my-stages") return t("shell.myStages");
    return t(`sections.${key}`);
  };

  const items: NavItem[] = [
    { key: "dashboard", label: "", href: "/dashboard" },
    { key: "my-stages", label: "", href: "/dashboard/my-stages" },
    ...nav,
  ];

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    notifications.show({ message: t("shell.loggedOut"), color: "gray" });
    router.replace("/login");
    router.refresh();
  }

  const fullName = [user.lastName, user.firstName, user.middleName]
    .filter(Boolean)
    .join(" ");

  return (
    <UserProvider user={user}>
      <AppShell
        header={{ height: 64 }}
        navbar={{
          width: 280,
          breakpoint: "sm",
          collapsed: { mobile: !opened },
        }}
        padding="lg"
      >
        <AppShell.Header
          style={{
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--mantine-color-gray-2)",
          }}
        >
          <Group h="100%" px="lg" justify="space-between">
            <Group gap="sm">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <Logo height={40} />
            </Group>

            <Group gap="sm">
            <LanguageSwitcher compact />
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs">
                    <Avatar
                      src={user.photo || undefined}
                      radius="xl"
                      size={36}
                      color="steel"
                    >
                      {user.firstName?.[0]}
                      {user.lastName?.[0]}
                    </Avatar>
                    <Box visibleFrom="sm">
                      <Text size="sm" fw={600} lh={1.1}>
                        {user.firstName} {user.lastName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {pickName(user.role, lang)}
                      </Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{fullName}</Menu.Label>
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={logout}
                >
                  {t("shell.logout")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar
          p="md"
          withBorder={false}
          style={{
            background: "linear-gradient(185deg, #122c5c 0%, #0d1a38 100%)",
            color: "rgba(255,255,255,0.75)",
          }}
        >
          <AppShell.Section grow component={ScrollArea}>
            {items.map((item, i) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ x: 3 }}
                >
                  <UnstyledButton
                    component={Link}
                    href={item.href}
                    onClick={() => opened && toggle()}
                    style={{
                      position: "relative",
                      display: "block",
                      width: "100%",
                      padding: `${rem(11)} ${rem(12)}`,
                      borderRadius: rem(12),
                      marginBottom: rem(6),
                      background: active
                        ? "linear-gradient(135deg, rgba(47,102,201,0.35), rgba(34,167,224,0.18))"
                        : "transparent",
                      border: active
                        ? "1px solid rgba(120,170,240,0.35)"
                        : "1px solid transparent",
                      color: active ? "#ffffff" : "rgba(255,255,255,0.78)",
                      boxShadow: active
                        ? "0 8px 20px rgba(6,18,45,0.5)"
                        : "none",
                      transition: "background 150ms ease, color 150ms ease",
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 10,
                          bottom: 10,
                          width: 3,
                          borderRadius: 3,
                          background:
                            "linear-gradient(180deg, #4dabf7, #22a7e0)",
                        }}
                      />
                    )}
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <Box
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            display: "grid",
                            placeItems: "center",
                            background: active
                              ? "linear-gradient(135deg, #2f66c9, #22a7e0)"
                              : "rgba(255,255,255,0.08)",
                            color: active ? "#fff" : "rgba(255,255,255,0.85)",
                          }}
                        >
                          {ICONS[item.key] ?? <IconBox size={20} />}
                        </Box>
                        <Text size="sm" fw={active ? 700 : 500} c="inherit">
                          {navLabel(item.key)}
                        </Text>
                      </Group>
                      {active && <IconChevronRight size={16} />}
                    </Group>
                  </UnstyledButton>
                </motion.div>
              );
            })}
          </AppShell.Section>

          <AppShell.Section>
            <Text size="xs" ta="center" style={{ color: "rgba(255,255,255,0.5)" }}>
              {t("shell.copyright")}
            </Text>
          </AppShell.Section>
        </AppShell.Navbar>

        <AppShell.Main
          style={{
            background:
              "radial-gradient(1000px 600px at 100% 0%, #eef3fb 0%, #f6f8fb 40%, #f4f6f9 100%)",
          }}
        >
          {children}
        </AppShell.Main>
      </AppShell>
    </UserProvider>
  );
}
