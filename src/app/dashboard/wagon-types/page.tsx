import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listWagonTypes } from "@/lib/wagon-types-list";
import { WagonTypesClient } from "./WagonTypesClient";

// Справочник собираем на сервере и отдаём вместе со страницей.
export const dynamic = "force-dynamic";

export default async function WagonTypesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "wagon-types", "view")) redirect("/dashboard");

  return <WagonTypesClient initialTypes={await listWagonTypes()} />;
}
