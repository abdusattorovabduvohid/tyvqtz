import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listUsers } from "@/lib/users-list";
import { listRoleOptions } from "@/lib/options";
import { UsersClient } from "./UsersClient";

// Список собираем на сервере и отдаём вместе со страницей: иначе телефон
// идёт за ним вторым заходом, а каждый заход до серверов — 0.4 секунды.
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "users", "view")) redirect("/dashboard");

  const [users, roles] = await Promise.all([
    listUsers({ withPasswords: user.role.isSuperAdmin }),
    listRoleOptions(),
  ]);

  return <UsersClient initialUsers={users} roles={roles} />;
}
