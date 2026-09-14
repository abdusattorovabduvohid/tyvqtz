import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleError, requireSuperAdmin } from "@/lib/api";
import { DEVICE_SELECT, deviceRow } from "@/lib/device-guard";

// Список одобренных устройств. Отдельно от /api/control намеренно: панель
// обновляется раз в 30 секунд, а этот список нужен раз в месяц — когда
// человек сменил телефон и старый надо забыть.
export async function GET() {
  try {
    await requireSuperAdmin();
    const devices = await prisma.userDevice.findMany({
      where: { approved: true },
      orderBy: { lastSeenAt: "desc" },
      take: 200,
      select: DEVICE_SELECT,
    });
    return NextResponse.json({ devices: devices.map(deviceRow) });
  } catch (err) {
    return handleError(err);
  }
}

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "remove"]),
});

// Решение суперадмина по устройству.
//
// approve — с этого телефона человеку можно входить.
// remove — строку удаляем. Для неодобренного это «отклонить»: попробуют
// снова — строка и сообщение в телеграм появятся заново. Для одобренного —
// «забыть телефон»: следующий вход с него уже потребует одобрения.
export async function POST(req: Request) {
  try {
    const admin = await requireSuperAdmin();
    const { id, action } = schema.parse(await req.json());

    if (action === "approve") {
      await prisma.userDevice.update({
        where: { id },
        data: { approved: true, approvedAt: new Date(), approvedBy: admin.id },
      });
    } else {
      // deleteMany, а не delete: двойное нажатие на медленном интернете
      // не должно вылетать ошибкой «записи уже нет»
      await prisma.userDevice.deleteMany({ where: { id } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }
    return handleError(err);
  }
}
