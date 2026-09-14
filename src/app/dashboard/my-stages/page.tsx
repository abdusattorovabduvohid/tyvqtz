import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMyStages } from "@/lib/my-stages-data";
import { MyStagesClient } from "./MyStagesClient";

// Данные собираем на сервере и отдаём вместе со страницей: смену начинают
// именно с этого экрана, и лишний поход до серверов здесь заметнее всего.
export const dynamic = "force-dynamic";

export default async function MyStagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <MyStagesClient initial={await getMyStages(user)} />;
}
