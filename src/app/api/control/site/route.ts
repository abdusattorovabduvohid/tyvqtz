import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, requireSuperAdmin } from "@/lib/api";
import { setSiteEnabled } from "@/lib/settings";

const schema = z.object({ enabled: z.boolean() });

// Общий рубильник сайта. Работает мгновенно и без деплоя — в этом весь
// смысл: суперадмин должен уметь погасить систему с телефона.
export async function POST(req: Request) {
  try {
    const admin = await requireSuperAdmin();
    const { enabled } = schema.parse(await req.json());
    await setSiteEnabled(enabled, admin.id);
    return NextResponse.json({ ok: true, siteEnabled: enabled });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }
    return handleError(err);
  }
}
