import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { getMyStages } from "@/lib/my-stages-data";

// Рабочий интерфейс исполнителя. Сама выборка — в lib/my-stages-data.ts:
// её же зовёт страница, когда собирается на сервере.
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await getMyStages(user));
  } catch (err) {
    return handleError(err);
  }
}
