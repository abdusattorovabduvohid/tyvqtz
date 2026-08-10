import { NextResponse } from "next/server";
import { NOTIFICATIONS_ENABLED } from "./features";

// Заглушка для роутов выключенного раздела: снаружи его как будто нет.
// Возвращает готовый ответ или null, если раздел включён.
export function notificationsOff(): NextResponse | null {
  if (NOTIFICATIONS_ENABLED) return null;
  return NextResponse.json({ error: "Раздел отключён" }, { status: 404 });
}
