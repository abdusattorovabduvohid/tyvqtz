import { cookies } from "next/headers";
import { DEFAULT_LANG, type Lang } from "./translations";

// Текущий язык из cookie (для серверных компонентов).
export function getLang(): Lang {
  const v = cookies().get("lang")?.value;
  return v === "uz" || v === "ru" ? v : DEFAULT_LANG;
}
