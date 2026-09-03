import { redirect } from "next/navigation";
import { Box, Text, Title } from "@mantine/core";
import { getCurrentUser } from "@/lib/auth";
import { isSiteEnabled } from "@/lib/settings";
import { getLang } from "@/lib/i18n/server";
import { Logo } from "@/components/Logo";

// Заглушка на время, пока суперадмин держит систему выключенной.
//
// Отдельная страница вне /dashboard: тот layout сам редиректит сюда, и
// заглушка внутри него закрутила бы редиректы по кругу.

export const dynamic = "force-dynamic";

export default async function OfflinePage() {
  // Если сайт уже включили обратно — незачем держать человека на заглушке.
  // Суперадмина сюда тоже не пускаем: для него система работает всегда.
  const user = await getCurrentUser();
  if ((await isSiteEnabled()) || user?.role.isSuperAdmin) redirect("/dashboard");

  const ru = getLang() === "ru";

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background:
          "radial-gradient(1200px 800px at 20% 10%, #16346b 0%, #0d1a38 45%, #081124 100%)",
      }}
    >
      <Box
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 22,
          padding: "40px 34px",
          textAlign: "center",
          boxShadow: "0 30px 70px rgba(3,12,32,0.5)",
        }}
      >
        <Logo height={84} />
        <Title order={4} mt="lg" style={{ color: "#122c5c", lineHeight: 1.3 }}>
          {ru ? "Ведутся технические работы" : "Texnik ishlar olib borilmoqda"}
        </Title>
        <Text size="sm" c="dimmed" mt="sm" lh={1.6}>
          {ru
            ? "Система временно выключена администратором. Ваши данные на месте — подождите немного и обновите страницу."
            : "Tizim administrator tomonidan vaqtincha o'chirilgan. Ma'lumotlaringiz joyida — biroz kutib, sahifani yangilang."}
        </Text>
      </Box>
    </Box>
  );
}
