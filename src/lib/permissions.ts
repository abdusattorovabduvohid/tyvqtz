// Каталог разделов и действий для системы прав (RBAC).
// При создании роли админ выбирает, какие секции показывать пользователю
// и какие действия в них разрешить. У суперадмина — все доступы.

export type Action = "view" | "create" | "update" | "delete";

export interface SectionDef {
  key: string;
  label: string;
  description: string;
  // путь в админке (для построения меню)
  href: string;
  // доступные действия в секции
  actions: Action[];
}

export const ACTION_LABELS: Record<Action, string> = {
  view: "Просмотр",
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
};

export const SECTIONS: SectionDef[] = [
  {
    key: "users",
    label: "Пользователи",
    description: "Список и управление пользователями",
    href: "/dashboard/users",
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "roles",
    label: "Роли",
    description: "Список ролей и настройка доступов",
    href: "/dashboard/roles",
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "wagon-types",
    label: "Типы вагонов",
    description: "Справочник типов вагонов",
    href: "/dashboard/wagon-types",
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "stages",
    label: "Этапы",
    description: "Этапы для создания вагонов",
    href: "/dashboard/stages",
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "wagons",
    label: "Вагоны",
    description: "Создание и ведение вагонов по этапам",
    href: "/dashboard/wagons",
    actions: ["view", "create", "update", "delete"],
  },
];

export type Permissions = Record<string, Action[]>;

export function parsePermissions(raw: string | null | undefined): Permissions {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Permissions;
  } catch {
    // ignore malformed JSON
  }
  return {};
}

export interface SessionRole {
  id: string;
  nameUz: string;
  nameRu: string | null;
  isSuperAdmin: boolean;
  permissions: Permissions;
}

// Проверка: разрешено ли действие в секции для данной роли.
export function can(
  role: Pick<SessionRole, "isSuperAdmin" | "permissions"> | null | undefined,
  section: string,
  action: Action
): boolean {
  if (!role) return false;
  if (role.isSuperAdmin) return true;
  const allowed = role.permissions?.[section];
  return Array.isArray(allowed) && allowed.includes(action);
}

// Секции, доступные роли хотя бы на просмотр (для построения меню).
export function visibleSections(
  role: Pick<SessionRole, "isSuperAdmin" | "permissions"> | null | undefined
): SectionDef[] {
  if (!role) return [];
  if (role.isSuperAdmin) return SECTIONS;
  return SECTIONS.filter((s) => can(role, s.key, "view"));
}
