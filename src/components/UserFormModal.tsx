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
  rem,
} from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconUpload, IconPhoto, IconX } from "@tabler/icons-react";
import { apiFetch } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";

export interface UserRow {
  id: string;
  login: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  isActive: boolean;
  role: { id: string; nameRu: string; nameUz: string | null };
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
  const [uploading, setUploading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      login: "",
      firstName: "",
      lastName: "",
      middleName: "",
      password: "",
      roleId: "",
    },
    validate: {
      login: (v) =>
        !editing && v.trim().length < 3 ? "Логин минимум 3 символа" : null,
      firstName: (v) => (v.trim() ? null : "Введите имя"),
      lastName: (v) => (v.trim() ? null : "Введите фамилию"),
      password: (v) =>
        !editing && v.length < 4 ? "Пароль минимум 4 символа" : null,
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
          password: "",
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

  async function handleDrop(files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch<{ url: string }>("/api/upload", {
        method: "POST",
        body: fd,
      });
      setPhoto(res.url);
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(values: typeof form.values) {
    setSaving(true);
    try {
      const payload: any = {
        firstName: values.firstName,
        lastName: values.lastName,
        middleName: values.middleName || null,
        photo: photo || null,
        roleId: values.roleId,
      };
      if (values.password) payload.password = values.password;

      if (editing && initial) {
        await apiFetch(`/api/users/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("users.updated") });
      } else {
        payload.login = values.login;
        await apiFetch("/api/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("users.created") });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
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
            <Group justify="center">
              <Stack align="center" gap="xs">
                <Avatar src={photo || undefined} size={88} radius="50%" color="steel">
                  {form.values.firstName?.[0]}
                  {form.values.lastName?.[0]}
                </Avatar>
                <Dropzone
                  onDrop={handleDrop}
                  accept={IMAGE_MIME_TYPE}
                  loading={uploading}
                  maxSize={5 * 1024 * 1024}
                  p="xs"
                  styles={{ inner: { pointerEvents: "all" } }}
                >
                  <Group gap="xs" justify="center" style={{ minHeight: rem(40) }}>
                    <Dropzone.Accept>
                      <IconUpload size={20} />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                      <IconX size={20} />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                      <IconPhoto size={20} />
                    </Dropzone.Idle>
                    <Text size="xs" c="dimmed">
                      {t("users.dropzone")}
                    </Text>
                  </Group>
                </Dropzone>
              </Stack>
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
            <TextInput
              label={t("users.middleName")}
              placeholder="Иванович"
              {...form.getInputProps("middleName")}
            />

            {!editing && (
              <TextInput
                label={t("login.login")}
                placeholder="ivanov"
                withAsterisk
                {...form.getInputProps("login")}
              />
            )}

            <Group grow>
              <PasswordInput
                label={editing ? t("users.passwordEdit") : t("users.password")}
                placeholder="••••••"
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
