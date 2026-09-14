import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getWagonDetail } from "@/lib/wagon-detail";
import { WagonDetailClient } from "./WagonDetailClient";

// Карточку собираем на сервере и отдаём вместе со страницей: иначе телефон
// сначала тянет страницу, а потом отдельно — данные вагона.
export const dynamic = "force-dynamic";

export default async function WagonDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "wagons", "view")) redirect("/dashboard");

  const data = await getWagonDetail(params.id);
  if (!data) notFound();

  return <WagonDetailClient initial={data} />;
}
