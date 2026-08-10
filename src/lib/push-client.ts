// Клиентская часть Web Push: подписка браузера на уведомления.
// Только браузерный код — на сервере не импортируется.

// VAPID-ключ приходит строкой base64url, а pushManager ждёт байты.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Обратно: ключ из уже существующей подписки — в base64url, чтобы сравнить
// его с текущим ключом сервера.
function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return window
    .btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Поддержка есть не везде: на iPhone пуши работают ТОЛЬКО если сайт добавлен
// на домашний экран (iOS 16.4+), в обычной вкладке Safari — нет.
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Похоже ли на iOS-браузер вне установленного приложения — тогда объясняем
// человеку, что надо «Добавить на экран «Домой»».
export function isIosWithoutPwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // старое яблочное свойство, в типах его нет
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return iOS && !standalone;
}

export function permission(): NotificationPermission | null {
  if (!pushSupported()) return null;
  return Notification.permission;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // SW регистрируется в ServiceWorkerRegistrar; здесь просто ждём готовности
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

// Подписать это устройство. Возвращает подписку или бросает понятную ошибку.
export async function subscribePush(publicKey: string): Promise<PushSubscription> {
  if (!pushSupported()) throw new Error("Bu qurilma bildirishnomani qo‘llamaydi");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Bildirishnomaga ruxsat berilmadi");

  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // Подписка могла остаться от прежнего VAPID-ключа — тогда сервер не сможет
    // на неё отправить. Такую переоформляем.
    const key = existing.options?.applicationServerKey;
    if (key && bufferToBase64Url(key) === publicKey) return existing;
    await existing.unsubscribe().catch(() => {});
  }

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
}

// Ключ, под который выдана существующая подписка (base64url), или null.
export async function subscriptionKey(sub: PushSubscription): Promise<string | null> {
  const key = sub.options?.applicationServerKey;
  return key ? bufferToBase64Url(key) : null;
}

export interface SyncResult {
  // что сделали: nothing — всё в порядке или подписки нет;
  // renewed — подписка была под старым ключом, переоформили;
  // resent — подписка та же, просто заново отдали серверу
  action: "nothing" | "renewed" | "resent";
  subscription?: PushSubscription;
  // адрес прежней подписки — его надо убрать из базы
  oldEndpoint?: string;
}

// Тихая починка подписки. Вызывается при заходе в систему, БЕЗ вопросов
// пользователю: разрешение у браузера уже есть, лишний раз спрашивать нечего.
//
// Зачем: если на сервере поменяли (или потеряли) VAPID-ключ, push-сервис
// перестаёт принимать наши отправки, а в браузере подписка выглядит живой.
// Сам сотрудник об этом не узнает — поэтому проверяем и переоформляем сами.
export async function syncSubscription(publicKey: string): Promise<SyncResult> {
  if (!pushSupported()) return { action: "nothing" };
  // разрешения нет — значит человек уведомления и не включал
  if (Notification.permission !== "granted") return { action: "nothing" };

  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  if (!existing) return { action: "nothing" };

  const current = await subscriptionKey(existing);
  if (current === publicKey) {
    // ключ тот же: просто напоминаем серверу о себе (вдруг запись потерялась)
    return { action: "resent", subscription: existing };
  }

  const oldEndpoint = existing.endpoint;
  await existing.unsubscribe().catch(() => {});
  const fresh = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  return { action: "renewed", subscription: fresh, oldEndpoint };
}

export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  return endpoint;
}
