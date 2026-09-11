import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleError, requireSuperAdmin } from "@/lib/api";

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
