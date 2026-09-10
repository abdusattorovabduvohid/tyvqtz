"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Button,
  Group,
  Stack,
  Avatar,
  Text,
  Box,
  LoadingOverlay,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { apiFetch, showError } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";

export interface UserRow {
  id: string;
  login: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  seh: string | null;
  // текущий пароль открытым текстом; у старых пользователей его нет
  passwordPlain?: string | null;
  isActive: boolean;
  role: { id: string; nameRu: string; nameUz: string | null };
  // подключил ли человек телеграм и сколько устройств ловят web push
  telegramLinked?: boolean;
  telegramUsername?: string | null;
  pushDevices?: number;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  roles: { value: string; label: string }[];
  initial?: UserRow | null;
}

export function UserFormModal({
  opened,
  onClose,
  onSaved,
  roles,
  initial,
}: Props) {
  const editing = Boolean(initial);
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      login: "",
      firstName: "",
      lastName: "",
      middleName: "",
      seh: "",
      password: "",
      roleId: "",
    },
    validate: {
      login: (v) => (v.trim().length < 3 ? "Логин минимум 3 символа" : null),
      firstName: (v) => (v.trim() ? null : "Введите имя"),
      lastName: (v) => (v.trim() ? null : "Введите фамилию"),
      // при редактировании поле можно очистить — тогда пароль не трогаем
      password: (v) =>
        (!editing || v.length > 0) && v.length < 4
          ? "Пароль минимум 4 символа"
          : null,
      roleId: (v) => (v ? null : "Выберите роль"),
    },
  });

  useEffect(() => {
    if (opened) {
      if (initial) {
        form.setValues({
          login: initial.login,
          firstName: initial.firstName,
          lastName: initial.lastName,
          middleName: initial.middleName ?? "",
          seh: initial.seh ?? "",
          // подставляем текущий пароль, чтобы он был виден и правился
          // на месте; у старых записей его нет — поле останется пустым
          password: initial.passwordPlain ?? "",
          roleId: initial.role.id,
        });
        setPhoto(initial.photo);
      } else {
        form.reset();
        setPhoto(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, initial]);

  async function handleSubmit(values: typeof form.values) {
    setSaving(true);
    try {
      // login отправляем всегда — его теперь можно менять и при
      // редактировании; password — только когда его действительно ввели
      const payload: {
        firstName: string;
        lastName: string;
        middleName: string | null;
        seh: string | null;
        photo: string | null;
        roleId: string;
        password?: string;
        login?: string;
      } = {
        firstName: values.firstName,
        lastName: values.lastName,
        middleName: values.middleName || null,
        seh: values.seh?.trim() || null,
        photo: photo || null,
        roleId: values.roleId,
        login: values.login.trim(),
      };
      // пароль шлём только если он вправду другой: иначе повторный хеш
      // поднял бы версию токена и выкинул человека из системы ни за что
      const passwordChanged =
        Boolean(values.password) &&
        values.password !== (initial?.passwordPlain ?? "");
      if (!editing || passwordChanged) payload.password = values.password;

      if (editing && initial) {
        await apiFetch(`/api/users/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("users.updated") });
      } else {
        await apiFetch("/api/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("users.created") });
      }
      onSaved();
      onClose();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editing ? t("users.modalEdit") : t("users.modalNew")}
      size="lg"
    >
      <Box pos="relative">
        <LoadingOverlay visible={saving} />
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            {/* Загрузка фото временно отключена: на Vercel файловая система
                только для чтения. Показываем аватар из инициалов. */}
            <Group justify="center">
              <Avatar src={photo || undefined} size={88} radius="50%" color="steel">
                <Text size="28px" fw={700}>
                  {(form.values.firstName?.[0] ?? "").toUpperCase()}
                  {(form.values.lastName?.[0] ?? "").toUpperCase()}
                </Text>
              </Avatar>
            </Group>

            <Group grow>
              <TextInput
                label={t("users.firstName")}
                placeholder="Иван"
                withAsterisk
                {...form.getInputProps("firstName")}
              />
              <TextInput
                label={t("users.lastName")}
                placeholder="Иванов"
                withAsterisk
                {...form.getInputProps("lastName")}
              />
            </Group>
            <Group grow>
              <TextInput
                label={t("users.middleName")}
                placeholder="Иванович"
                {...form.getInputProps("middleName")}
              />
              <TextInput
                label={t("users.seh")}
                placeholder="2"
                description={t("users.sehHint")}
                {...form.getInputProps("seh")}
              />
            </Group>

            <TextInput
              label={t("login.login")}
              placeholder="ivanov"
              description={editing ? t("users.loginEditHint") : undefined}
              withAsterisk
              {...form.getInputProps("login")}
            />

            <Group grow>
              {/* Пароль известен — показываем его как есть; если в базе его
                  нет (человек заведён до этой правки), поле пустое и
                  подпись объясняет, что старый пароль восстановить нельзя. */}
              <PasswordInput
                label={
                  editing && !initial?.passwordPlain
                    ? t("users.passwordEdit")
                    : t("users.password")
                }
                placeholder="••••••"
                description={
                  editing
                    ? initial?.passwordPlain
                      ? t("users.passwordKnownHint")
                      : t("users.passwordEditHint")
                    : undefined
                }
                withAsterisk={!editing}
                {...form.getInputProps("password")}
              />
              <Select
                label={t("users.col.role")}
                placeholder={t("users.selectRole")}
                withAsterisk
                data={roles}
                searchable
                {...form.getInputProps("roleId")}
              />
            </Group>

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? t("common.save") : t("common.create")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Box>
    </Modal>
  );
}
