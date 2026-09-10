// Общая проверка для кроновых эндпоинтов.
//
// Vercel Cron сам подставляет заголовок Authorization: Bearer <CRON_SECRET>.
// Внешним планировщикам (cron-job.org и т.п.) заголовок задавать неудобно,
// поэтому тот же секрет принимаем и в ?key=.
//
// Секрета нет — не пускаем никого: открытый крон-эндпоинт любой желающий
// дёргал бы в цикле и рассылал сотрудникам уведомления.
export function authorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}
