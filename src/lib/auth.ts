import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { parsePermissions, type SessionRole } from "./permissions";
import { touch } from "./presence";

const COOKIE_NAME = "session";
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me"
);

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  role: SessionRole;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// В токен кладём версию сессии. Кнопка «Выкинуть» увеличивает её в базе,
// и все ранее выданные токены этого человека перестают подходить —
// хранить список сессий на сервере для этого не нужно.
export async function createSessionToken(
  userId: string,
  tokenVersion = 0
): Promise<string> {
  return new SignJWT({ sub: userId, v: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function setSessionCookie(userId: string, tokenVersion = 0) {
  const token = await createSessionToken(userId, tokenVersion);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

// Текущий пользователь сессии с актуальными правами роли (из БД).
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  let userId: string;
  let tokenVersion = 0;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    userId = payload.sub as string;
    // У токенов, выданных до появления этого поля, версии нет — считаем 0,
    // иначе деплой разлогинил бы всех сотрудников разом.
    tokenVersion = typeof payload.v === "number" ? payload.v : 0;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user || !user.isActive) return null;
  // Сессию отозвали из панели контроля — токен больше не годится.
  if (user.tokenVersion !== tokenVersion) return null;

  // Отметка «был в сети». Внутри стоит троттлинг, лишних записей не будет.
  await touch(user.id);

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    photo: user.photo,
    role: {
      id: user.role.id,
      nameRu: user.role.nameRu,
      nameUz: user.role.nameUz,
      isSuperAdmin: user.role.isSuperAdmin,
      permissions: parsePermissions(user.role.permissions),
    },
  };
}
