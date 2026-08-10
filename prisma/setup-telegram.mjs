// Настройка телеграм-бота: ставит вебхук на наш сайт и показывает состояние.
//
// Запуск (после того как в .env заполнены TELEGRAM_BOT_TOKEN,
// TELEGRAM_WEBHOOK_SECRET и APP_URL):
//   node prisma/setup-telegram.mjs          — поставить вебхук
//   node prisma/setup-telegram.mjs info     — показать текущее состояние
//   node prisma/setup-telegram.mjs delete   — снять вебхук
//
// APP_URL должен быть публичным https-адресом (локальный localhost телеграм
// не примет — вебхук ставится на боевой сайт).

import { readFileSync } from "fs";

// .env читаем сами: скрипт запускается обычным node, без next
function loadEnv() {
  try {
    const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env может не быть — тогда переменные пришли из окружения
  }
}
loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = (process.env.APP_URL || "").replace(/\/+$/, "");
const mode = process.argv[2] || "set";

async function api(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
}

async function main() {
  if (!token) {
    console.error("Нет TELEGRAM_BOT_TOKEN в .env — возьмите токен у @BotFather");
    process.exit(1);
  }

  const me = await api("getMe");
  if (!me.ok) {
    console.error("Токен не подошёл:", me.description);
    process.exit(1);
  }
  console.log(`Бот: @${me.result.username} (${me.result.first_name})`);
  console.log("→ впишите это имя в TELEGRAM_BOT_USERNAME в .env и в Vercel");

  if (mode === "info") {
    const info = await api("getWebhookInfo");
    console.log(JSON.stringify(info.result, null, 2));
    return;
  }

  if (mode === "delete") {
    const res = await api("deleteWebhook", { drop_pending_updates: true });
    console.log(res.ok ? "Вебхук снят" : res.description);
    return;
  }

  if (!appUrl.startsWith("https://")) {
    console.error("APP_URL должен быть публичным https-адресом сайта");
    process.exit(1);
  }
  if (!secret) {
    console.error("Нет TELEGRAM_WEBHOOK_SECRET — придумайте длинную случайную строку");
    process.exit(1);
  }

  const res = await api("setWebhook", {
    url: `${appUrl}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  if (!res.ok) {
    console.error("Не удалось поставить вебхук:", res.description);
    process.exit(1);
  }
  console.log(`Вебхук поставлен: ${appUrl}/api/telegram/webhook`);

  // подсказки в меню бота — чтобы сотрудник не гадал
  await api("setMyCommands", {
    commands: [
      { command: "start", description: "Ulash (saytdagi kod bilan)" },
      { command: "stop", description: "Xabarlarni o‘chirish" },
      { command: "help", description: "Yordam" },
    ],
  });
  console.log("Команды бота обновлены");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
