import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { pushEnabled } from "@/lib/notify";

// Публичный VAPID-ключ сервера. Нужен PushAutoHeal, чтобы понять, не устарела
// ли подписка браузера (её выдавали под прежний ключ).
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({
      publicKey: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
