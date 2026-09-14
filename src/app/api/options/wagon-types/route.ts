import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { listWagonTypeOptions } from "@/lib/options";

// Список типов вагонов (id + название) для выпадающих списков.
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ types: await listWagonTypeOptions() });
  } catch (err) {
    return handleError(err);
  }
}
