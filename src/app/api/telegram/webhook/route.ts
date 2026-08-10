import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { telegramSend } from "@/lib/notify";
import { NOTIFICATIONS_ENABLED } from "@/lib/features";

// Вебхук телеграм-бота. Телеграм сам стучится сюда на каждое сообщение.
//
// БЕЗОПАСНОСТЬ: адрес вебхука публичный, поэтому телеграм присылает секрет
// в заголовке X-Telegram-Bot-Api-Secret-Token — сверяем его. Без секрета
// (TELEGRAM_WEBHOOK_SECRET не задан) вебхук просто не работает.
//
// Понимает две команды:
//   /start <код> — привязать этот чат к сотруднику (код берётся на сайте)
//   /stop        — отвязать

export async function POST(req: Request) {
  // раздел выключен: молча проглатываем апдейты, иначе телеграм копит ошибки
  if (!NOTIFICATIONS_ENABLED) return NextResponse.json({ ok: true });

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: true });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    // отвечаем 200, чтобы телеграм не долбил повторами по чужим запросам
    return NextResponse.json({ ok: true });
  }

  try {
    const update = await req.json();
    const msg = update?.message ?? update?.edited_message;
    const chatId = msg?.chat?.id;
    const text: string = (msg?.text ?? "").trim();
    if (!chatId || !text) return NextResponse.json({ ok: true });

    const chat = String(chatId);
    const tgUser = msg?.from?.username ? `@${msg.from.username}` : null;

    if (text.startsWith("/start")) {
      const code = text.split(/\s+/)[1];
      if (!code) {
        await telegramSend(
          chat,
          "Salom! Ulash uchun saytdagi «Bildirishnomalar» sahifasidan «Telegramni ulash» tugmasini bosing."
        );
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findUnique({
        where: { telegramLinkCode: code },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!user) {
        await telegramSend(chat, "Kod eskirgan yoki noto‘g‘ri. Saytdan yangi kod oling.");
        return NextResponse.json({ ok: true });
      }

      // этот же чат мог быть привязан к другому сотруднику — освобождаем
      await prisma.user.updateMany({
        where: { telegramChatId: chat, NOT: { id: user.id } },
        data: { telegramChatId: null, telegramUsername: null },
      });
      await prisma.user.update({
        where: { id: user.id },
        // код одноразовый: сразу гасим
        data: { telegramChatId: chat, telegramUsername: tgUser, telegramLinkCode: null },
      });

      await telegramSend(
        chat,
        `Tayyor, ${user.lastName} ${user.firstName}! Endi TYVQTZ tizimidagi xabarlar shu yerga keladi.\n\nO‘chirish uchun: /stop`
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/stop")) {
      await prisma.user.updateMany({
        where: { telegramChatId: chat },
        data: { telegramChatId: null, telegramUsername: null },
      });
      await telegramSend(chat, "Xabarlar o‘chirildi. Qayta ulash — saytdagi «Bildirishnomalar» sahifasida.");
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/help") || text.startsWith("/id")) {
      await telegramSend(
        chat,
        `Chat id: <code>${chat}</code>\n\n/start &lt;kod&gt; — ulash\n/stop — o‘chirish`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("telegram webhook", err);
    // всегда 200: иначе телеграм будет слать этот же апдейт снова и снова
    return NextResponse.json({ ok: true });
  }
}
