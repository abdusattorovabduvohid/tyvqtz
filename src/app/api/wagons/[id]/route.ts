import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";
import { getWagonDetail } from "@/lib/wagon-detail";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    await requirePermission("wagons", "view");
    const data = await getWagonDetail(params.id);
    if (!data) throw new ApiError(404, "Вагон не найден");
    return NextResponse.json(data);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requirePermission("wagons", "delete");
    await prisma.wagon.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
