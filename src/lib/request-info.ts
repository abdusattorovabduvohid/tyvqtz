// Что известно о запросе: адрес, город по адресу, устройство.
//
// Город берём из заголовков Vercel — он определяет его на своей стороне и
// отдаёт бесплатно, внешний сервис geo-IP подключать не нужно. При переезде
// на свой сервер заголовков не будет, и город просто станет пустым: журнал
// от этого не сломается.

import { parseUserAgent, modelFromClientHint, type DeviceInfo } from "./ua";

export interface RequestInfo extends DeviceInfo {
  ip: string | null;
  userAgent: string | null;
  ipCity: string | null;
  ipCountry: string | null;
}

function firstIp(forwarded: string | null): string | null {
  // x-forwarded-for — цепочка «клиент, прокси1, прокси2». Наш — первый.
  if (!forwarded) return null;
  const ip = forwarded.split(",")[0]?.trim();
  return ip || null;
}

export function getRequestInfo(req: Request): RequestInfo {
  const h = req.headers;
  const userAgent = h.get("user-agent");
  const parsed = parseUserAgent(userAgent);

  // Client Hints точнее User-Agent там, где Chrome спрятал модель.
  const hinted = modelFromClientHint(h.get("sec-ch-ua-model"));

  // Города Vercel отдаёт в percent-encoding: «Toshkent» приходит как Toshkent,
  // но «Nukus» с диакритикой — уже закодированным.
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v) || null;
    } catch {
      return v;
    }
  };

  return {
    ip: firstIp(h.get("x-forwarded-for")) ?? h.get("x-real-ip"),
    userAgent,
    device: hinted ?? parsed.device,
    os: parsed.os,
    browser: parsed.browser,
    ipCity: decode(h.get("x-vercel-ip-city")),
    ipCountry: h.get("x-vercel-ip-country"),
  };
}
