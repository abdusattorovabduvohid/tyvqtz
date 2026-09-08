import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/i18n/server";
import { HomeLanding } from "@/components/HomeLanding";

// Главная. Для сотрудника — короткий путь в дашборд, для всех остальных —
// настоящая страница с текстом.
//
// Раньше здесь стоял безусловный redirect на /login, и поисковик получал с
// главной пустой 307: индексировать было нечего, а по запросу «tyvqtz» сайт
// не находился вовсе.

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <HomeLanding ru={getLang() === "ru"} />;
}
