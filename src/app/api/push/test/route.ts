import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { notifyUsers } from "@/lib/notify";
import { notificationsOff } from "@/lib/feature-guard";

// «Проверить» на странице уведомлений: шлём пуш и телеграм самому себе.
// Так сотрудник сразу видит, дошло или нет, и не гадает.
export async function POST() {
  const off = notificationsOff();
  if (off) return off;

  try {
    const user = await requireUser();
    await notifyUsers([user.id], {
      title: "TYVQTZ — sinov xabari",
      body: "Bildirishnomalar ishlayapti. Shu xabar kelgan bo‘lsa, hammasi joyida.",
      url: "/dashboard",
      tag: "test",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
