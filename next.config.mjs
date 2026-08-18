/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Заголовок X-Powered-By ничего не даёт пользователю и лишний раз сообщает
  // о стеке — снимаем.
  poweredByHeader: false,

  images: {
    remotePatterns: [],
  },

  // Mantine отдаётся одним «бочонком»: `import { Text } from "@mantine/core"`
  // тянет за собой весь пакет. Next переписывает такие импорты в точечные,
  // и в бандл попадает только то, что реально используется.
  // @tabler/icons-react Next оптимизирует сам, по умолчанию.
  experimental: {
    optimizePackageImports: [
      "@mantine/core",
      "@mantine/hooks",
      "@mantine/form",
      "@mantine/modals",
      "@mantine/notifications",
    ],
  },
};

export default nextConfig;
