import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listWagons } from "@/lib/wagons-list";
import { listWagonTypeOptions } from "@/lib/options";
import { WagonsClient } from "./WagonsClient";

// Данные собираем здесь, на сервере, и отдаём вместе со страницей. Раньше
// телефон получал пустую страницу и только потом шёл за списком в
// /api/wagons — два похода до серверов подряд, по 0.4 секунды каждый.
export const dynamic = "force-dynamic";

export default async function WagonsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // В меню такого пункта у него и нет, но по прямой ссылке зайти можно.
  if (!can(user.role, "wagons", "view")) redirect("/dashboard");

  const [wagons, types] = await Promise.all([
    listWagons(),
    listWagonTypeOptions(),
  ]);

  // useSearchParams внутри требует границы Suspense.
  return (
    <Suspense fallback={null}>
      <WagonsClient initialWagons={wagons} types={types} />
    </Suspense>
  );
}
