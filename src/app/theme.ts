"use client";

import { createTheme, rem, type MantineColorsTuple } from "@mantine/core";

// Премиальная палитра «сапфир» — глубокий сине-стальной с акцентом.
// Токен оставлен как "steel" (используется по всему приложению).
const steel: MantineColorsTuple = [
  "#eaf1fb",
  "#d3e0f4",
  "#a6bfe8",
  "#769cdc",
  "#5080d2",
  "#3a6fcc",
  "#2f66c9", // 6 — основной оттенок
  "#2453ab", // 7
  "#1c4288", // 8
  "#122c5c", // 9 — глубокий navy (тёмная панель)
];

// Тёмная навигация (глубокий navy для sidebar/header акцентов).
const navy: MantineColorsTuple = [
  "#e7ecf5",
  "#c3cfe3",
  "#9aabcc",
  "#7288b6",
  "#5069a4",
  "#3a5596",
  "#2f4b8f",
  "#243c76",
  "#182a56",
  "#0d1a38",
];

export const theme = createTheme({
  primaryColor: "steel",
  primaryShade: { light: 6, dark: 7 },
  colors: { steel, navy },
  defaultRadius: "md",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  headings: {
    fontWeight: "800",
  },
  shadows: {
    xs: "0 1px 2px rgba(16,32,64,0.06)",
    sm: "0 2px 8px rgba(16,32,64,0.06)",
    md: "0 6px 20px rgba(16,32,64,0.08)",
    lg: "0 12px 32px rgba(16,32,64,0.10)",
    xl: "0 22px 48px rgba(16,32,64,0.14)",
  },
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
        shadow: "sm",
      },
    },
    Paper: {
      defaultProps: {
        radius: "lg",
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        centered: true,
        overlayProps: { backgroundOpacity: 0.6, blur: 6 },
      },
    },
  },
  other: {
    headerHeight: rem(64),
  },
});
