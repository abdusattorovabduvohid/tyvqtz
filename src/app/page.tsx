import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// Главная никакой своей страницы не показывает: сотрудник заходит работать,
// а не читать о системе. Была попытка поставить сюда посадочную страницу
// ради поиска — владелец её отклонил, вернули как было.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
