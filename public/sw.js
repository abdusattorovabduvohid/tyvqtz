// Service worker для TYVQTZ.
//
// ГЛАВНОЕ ПРАВИЛО: это внутренняя система учёта, данные должны быть свежими.
// Мы НИКОГДА не кешируем /api/* и HTML-навигации — иначе сотрудник увидит
// устаревшее состояние вагона/этапа и внесёт неверные данные.
// Кешируем только статику, которая не может «протухнуть».

// Версии подняты до v2: сбрасываем всё, что осело в кеше за прошлые деплои.
const STATIC_CACHE = "tyvqtz-static-v2";
const MEDIA_CACHE = "tyvqtz-media-v2";
const KNOWN_CACHES = [STATIC_CACHE, MEDIA_CACHE];

// Фото вагонов тяжёлые. Без ограничения кеш растёт бесконечно и давит на
// память — в установленной PWA это ускоряет «убийство» процесса системой.
const MEDIA_MAX_ENTRIES = 60;

// Оставляем в кеше не больше max записей, самые старые удаляем (по порядку
// добавления — Cache API отдаёт ключи в этом порядке).
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (const key of keys.slice(0, keys.length - max)) {
    await cache.delete(key);
  }
}

self.addEventListener("install", () => {
  // Ничего не префетчим: новая сборка Next меняет хеши файлов,
  // список пришлось бы держать в синхроне вручную.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// /_next/static/* — файлы с хешем в имени, содержимое по этому URL
// никогда не меняется. Cache-first безопасен на 100%.
function isImmutableAsset(pathname) {
  return pathname.startsWith("/_next/static/");
}

// Иконки, og-картинка, логотип — меняются раз в год.
function isAppAsset(pathname) {
  return (
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/") ||
    pathname === "/og.png"
  );
}

// Загруженные фото вагонов — тяжёлые, а связь на территории завода слабая.
// Отдаём из кеша сразу, но в фоне перекачиваем: если фото заменили под тем же
// именем, следующее открытие покажет новое.
function isUpload(pathname) {
  return pathname.startsWith("/uploads/");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);

  const fetching = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache
          .put(request, response.clone())
          .then(() => trimCache(cacheName, MEDIA_MAX_ENTRIES));
      }
      return response;
    })
    // офлайн: если в кеше пусто — пусть ошибка дойдёт до вызывающего
    .catch((err) => {
      if (hit) return hit;
      throw err;
    });

  return hit || fetching;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Навигации и API — всегда из сети, без участия SW.
  if (request.mode === "navigate") return;
  if (url.pathname.startsWith("/api/")) return;

  if (isImmutableAsset(url.pathname) || isAppAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isUpload(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE));
  }
});
