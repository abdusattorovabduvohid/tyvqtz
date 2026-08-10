import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { pushEnabled } from "@/lib/notify";
import { notificationsOff } from "@/lib/feature-guard";

// Публичный VAPID-ключ сервера. Нужен PushAutoHeal, чтобы понять, не устарела
// ли подписка браузера (её выдавали под прежний ключ).
export async function GET() {
  const off = notificationsOff();
  if (off) return off;

  try {
    await requireUser();
    return NextResponse.json({
      publicKey: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
