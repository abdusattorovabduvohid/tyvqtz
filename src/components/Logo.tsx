import Image from "next/image";

// Логотип TYVQTZ — официальный файл завода.
const LOGO_SRC = "/brand/logo.png";

// Собственный размер файла: из него считается ширина под нужную высоту.
const LOGO_W = 317;
const LOGO_H = 148;

/**
 * Логотип фиксированной высоты.
 *
 * Через next/image, а не голый <img>: браузеру телефона уезжает лёгкий webp
 * нужного размера вместо исходного PNG на 20 КБ. Ширина и высота заданы явно,
 * поэтому место под картинку резервируется сразу и шапка не «прыгает», пока
 * логотип грузится.
 *
 * priority — логотип виден на первом экране и на входе, и в шапке: без него
 * Next отложил бы загрузку и на медленной связи в углу зияла бы пустота.
 */
export function Logo({
  height = 40,
  className,
  style,
}: {
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt="TYVQTZ"
      width={Math.round((height * LOGO_W) / LOGO_H)}
      height={height}
      priority
      className={className}
      style={{ height, width: "auto", display: "block", ...style }}
    />
  );
}
