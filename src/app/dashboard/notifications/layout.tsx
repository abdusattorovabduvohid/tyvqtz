import { notFound } from "next/navigation";
import { NOTIFICATIONS_ENABLED } from "@/lib/features";

// Раздел выключен в features.ts — страницы просто нет, как будто её и не было.
export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!NOTIFICATIONS_ENABLED) notFound();
  return <>{children}</>;
}
