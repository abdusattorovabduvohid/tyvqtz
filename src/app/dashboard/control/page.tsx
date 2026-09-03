import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ControlPanel } from "@/components/ControlPanel";

// Панель контроля. Правами из RBAC не настраивается: либо суперадмин,
// либо раздела для человека не существует.
export const dynamic = "force-dynamic";

export default async function ControlPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.role.isSuperAdmin) redirect("/dashboard");

  return <ControlPanel meId={user.id} />;
}
