import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { telegramEnabled } from "@/lib/notify";

// Подключение телеграма одноразовым кодом:
// сайт даёт код → человек открывает t.me/<bot>?start=<код> → бот в вебхуке
// находит сотрудника по коду и запоминает его chat id.
export async function POST() {
  try {
    const user = await requireUser();
    if (!telegramEnabled()) {
      throw new ApiError(400, "Телеграм-бот не настроен");
    }

    const code = randomBytes(12).toString("base64url");
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramLinkCode: code },
    });

    const bot = process.env.TELEGRAM_BOT_USERNAME || "";
    return NextResponse.json({
      code,
      link: bot ? `https://t.me/${bot}?start=${code}` : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

// Отключить телеграм у себя.
export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: null, telegramUsername: null, telegramLinkCode: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
