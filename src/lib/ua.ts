// Разбор User-Agent: устройство, система, браузер.
//
// Своими руками, без библиотеки: нам нужно четыре строки для журнала, а не
// полноценное определение устройства. Готовый парсер тянул бы в бандл
// мегабайт таблиц ради этого.
//
// ВАЖНО про модель телефона:
//   Android — модель в UA есть: «Linux; Android 13; SM-A536B».
//   iPhone  — модели НЕТ и не будет: Apple намеренно отдаёт всем один
//             «iPhone». Отличить iPhone 11 от iPhone 16 невозможно.
//   Свежий Chrome на Android модель тоже прячет, подставляя «K». Тогда
//             её отдаёт заголовок Sec-CH-UA-Model — см. parseClientHints.

export interface DeviceInfo {
  device: string | null; // «Samsung SM-A536B», «iPhone», «Kompyuter»
  os: string | null; // «Android 13», «iOS 17.5», «Windows 10»
  browser: string | null; // «Chrome 129», «Safari 17.5»
}

// Коды моделей ни о чём не говорят, поэтому подписываем хотя бы производителя.
function vendorOf(model: string): string | null {
  if (/^SM-/i.test(model)) return "Samsung";
  if (/^(Redmi|POCO|M\d{4}|2\d{6})/i.test(model)) return "Xiaomi";
  if (/^(RMX|realme)/i.test(model)) return "realme";
  if (/^(CPH|OPPO)/i.test(model)) return "OPPO";
  if (/^(V\d{4}|vivo)/i.test(model)) return "vivo";
  if (/^(ELE|ANA|NOH|LIO|VOG|JNY|STK|DRA)/i.test(model)) return "Huawei";
  if (/^(Infinix|X6\d{3})/i.test(model)) return "Infinix";
  if (/^(TECNO|CK\d)/i.test(model)) return "TECNO";
  if (/^Pixel/i.test(model)) return "Google";
  return null;
}

function androidModel(ua: string): string | null {
  // «Linux; Android 13; SM-A536B Build/…» или «…; SM-A536B)»
  const m = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/i);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  // «K» — заглушка урезанного User-Agent новых версий Chrome, не модель
  if (raw === "K" || raw.length < 2) return null;
  return raw;
}

function browserOf(ua: string): string | null {
  // Порядок важен: Edge и Opera тоже пишут о себе «Chrome», а Chrome —
  // «Safari». Кто представляется чужим именем, того проверяем первым.
  const rules: Array<[RegExp, string]> = [
    [/Edg(?:A|iOS)?\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)|Opera\/([\d.]+)/, "Opera"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/YaBrowser\/([\d.]+)/, "Yandex"],
    [/Firefox\/([\d.]+)|FxiOS\/([\d.]+)/, "Firefox"],
    [/(?:Chrome|CriOS)\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
  ];
  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) {
      const major = (m[1] ?? m[2] ?? "").split(".")[0];
      return major ? `${name} ${major}` : name;
    }
  }
  return null;
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { device: null, os: null, browser: null };

  const browser = browserOf(ua);

  // iOS: версия пишется через подчёркивания — «iPhone OS 17_5»
  const ios = ua.match(/(iPhone|iPad|iPod).*?OS ([\d_]+)/i);
  if (ios) {
    return {
      device: ios[1], // модели тут не будет никогда — так решила Apple
      os: `iOS ${ios[2].replace(/_/g, ".")}`,
      browser,
    };
  }

  const android = ua.match(/Android ([\d.]+)/i);
  if (android) {
    const model = androidModel(ua);
    const vendor = model ? vendorOf(model) : null;
    return {
      device: model ? (vendor ? `${vendor} ${model}` : model) : "Android",
      os: `Android ${android[1]}`,
      browser,
    };
  }

  if (/Windows NT 10/.test(ua)) return { device: "Kompyuter", os: "Windows 10/11", browser };
  if (/Windows NT/.test(ua)) return { device: "Kompyuter", os: "Windows", browser };
  if (/Macintosh/.test(ua)) return { device: "Mac", os: "macOS", browser };
  if (/Linux/.test(ua)) return { device: "Kompyuter", os: "Linux", browser };

  return { device: null, os: null, browser };
}

// Sec-CH-UA-Model отдаёт модель там, где Chrome урезал её в User-Agent.
// Заголовок приходит, только если мы попросили его через Accept-CH
// (см. next.config.mjs). Значение — в кавычках: "SM-A536B".
export function modelFromClientHint(hint: string | null | undefined): string | null {
  if (!hint) return null;
  const model = hint.replace(/^"|"$/g, "").trim();
  if (!model || model === "K") return null;
  const vendor = vendorOf(model);
  return vendor ? `${vendor} ${model}` : model;
}
