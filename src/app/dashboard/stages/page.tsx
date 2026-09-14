import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listStages } from "@/lib/stages-list";
import { StagesClient } from "./StagesClient";

// Справочник собираем на сервере и отдаём вместе со страницей.
export const dynamic = "force-dynamic";

export default async function StagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "stages", "view")) redirect("/dashboard");

  return <StagesClient initialStages={await listStages()} />;
}
