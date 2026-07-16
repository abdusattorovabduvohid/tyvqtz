import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireUser, handleError, ApiError } from "@/lib/api";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Файл не передан");
    if (!ALLOWED.includes(file.type)) {
      throw new ApiError(400, "Допустимы только изображения (jpg, png, webp, gif)");
    }
    if (file.size > MAX_SIZE) throw new ApiError(400, "Файл больше 5 МБ");

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeName = `${Date.now()}-${Math.round(
      bytes.length % 100000
    )}.${ext}`;

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safeName), bytes);

    return NextResponse.json({ url: `/uploads/${safeName}` });
  } catch (err) {
    return handleError(err);
  }
}
