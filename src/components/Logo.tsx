// Логотип TYVQTZ — официальный файл завода.
const LOGO_SRC = "/brand/logo.png";

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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="TYVQTZ"
      className={className}
      style={{ height, width: "auto", display: "block", ...style }}
    />
  );
}
