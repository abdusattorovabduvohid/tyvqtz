import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { parsePermissions, type SessionRole } from "./permissions";

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

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function setSessionCookie(userId: string) {
  const token = await createSessionToken(userId);
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
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    userId = payload.sub as string;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user || !user.isActive) return null;

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
