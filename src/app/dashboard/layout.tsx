import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleSections } from "@/lib/permissions";
import { isSiteEnabled } from "@/lib/settings";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Сайт выключен суперадмином — сотрудника выставляем на страницу-заглушку.
  // Проверка стоит в layout, а не в middleware: middleware крутится на edge,
  // где Prisma не работает, а тащить ради одного флага отдельный запрос
  // на каждый переход дороже, чем проверить здесь.
  if (!user.role.isSuperAdmin && !(await isSiteEnabled())) {
    redirect("/offline");
  }

  const nav: NavItem[] = visibleSections(user.role).map((s) => ({
    key: s.key,
    label: s.label,
    href: s.href,
  }));

  // Панель контроля не входит в систему прав: её видит только суперадмин.
  if (user.role.isSuperAdmin) {
    nav.push({ key: "control", label: "", href: "/dashboard/control" });
  }

  return (
    <DashboardShell user={user} nav={nav}>
      {children}
    </DashboardShell>
  );
}
