/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Заголовок X-Powered-By ничего не даёт пользователю и лишний раз сообщает
  // о стеке — снимаем.
  poweredByHeader: false,

  images: {
    remotePatterns: [],
  },

  // Просим у браузера модель устройства отдельным заголовком.
  //
  // Свежий Chrome на Android урезал User-Agent и вместо модели подставляет
  // «K». Настоящую модель он отдаёт только через Client Hints и только если
  // сайт их запросил — вот этим заголовком. Браузер пришлёт подсказку со
  // СЛЕДУЮЩИМ запросом, поэтому страницу входа отдаём с ним, а читаем уже
  // в POST /api/auth/login.
  //
  // На iPhone это ничего не меняет: модели там нет ни в User-Agent, ни в
  // подсказках — Apple её не сообщает принципиально.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Accept-CH", value: "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version" },
        ],
      },
    ];
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
