import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { visibleSections } from "@/lib/permissions";
import { DashboardShell, type NavItem } from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const nav: NavItem[] = visibleSections(user.role).map((s) => ({
    key: s.key,
    label: s.label,
    href: s.href,
  }));

  return (
    <DashboardShell user={user} nav={nav}>
      {children}
    </DashboardShell>
  );
}
