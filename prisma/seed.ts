import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Роль суперадмина — все доступы.
  const superRole = await prisma.role.upsert({
    where: { nameUz: "Superadmin" },
    update: { isSuperAdmin: true },
    create: {
      nameUz: "Superadmin",
      nameRu: "Суперадмин",
      isSuperAdmin: true,
      permissions: "{}",
    },
  });

  // Исполнитель — назначается на этапы, даёт разрешения на запуск.
  const executorPerms = JSON.stringify({
    wagons: ["view"],
    stages: ["view"],
    "wagon-types": ["view"],
  });
  await prisma.role.upsert({
    where: { nameUz: "Ijrochi" },
    update: { nameRu: "Исполнитель", permissions: executorPerms },
    create: {
      nameUz: "Ijrochi",
      nameRu: "Исполнитель",
      isSuperAdmin: false,
      permissions: executorPerms,
    },
  });

  // Директор — наблюдает за ходом работ (только просмотр).
  const directorPerms = JSON.stringify({
    wagons: ["view"],
    stages: ["view"],
    "wagon-types": ["view"],
    users: ["view"],
    roles: ["view"],
  });
  await prisma.role.upsert({
    where: { nameUz: "Direktor" },
    update: { nameRu: "Директор", permissions: directorPerms },
    create: {
      nameUz: "Direktor",
      nameRu: "Директор",
      isSuperAdmin: false,
      permissions: directorPerms,
    },
  });

  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { id: "seed-superadmin" },
    update: {},
    create: {
      id: "seed-superadmin",
      login: "admin",
      firstName: "Супер",
      lastName: "Админ",
      middleName: null,
      passwordHash,
      roleId: superRole.id,
    },
  });

  console.log("✔ Seed завершён.");
  console.log("  Логин:  admin");
  console.log("  Пароль: admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
