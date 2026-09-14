import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listRoles } from "@/lib/roles-list";
import { RolesClient } from "./RolesClient";

// Список собираем на сервере и отдаём вместе со страницей — иначе телефон
// идёт за ним вторым заходом, а каждый заход до серверов ~0.4 секунды.
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "roles", "view")) redirect("/dashboard");

  return <RolesClient initialRoles={await listRoles()} />;
}
