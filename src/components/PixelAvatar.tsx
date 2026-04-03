import Image from "next/image";

interface PixelAvatarProps {
  seed?: string | number | null;
  alt?: string;
  size?: number;
  className?: string;
}

const BACKGROUND_COLORS = [
  "b6e3f4",
  "c0aede",
  "d1d4f9",
  "ffd5dc",
  "ffdfbf",
  "fef3c7",
  "d9f99d",
  "bae6fd",
  "e9d5ff",
  "fecdd3",
  "ddd6fe",
  "bfdbfe",
];

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeSeed(seed?: string | number | null) {
  const value = String(seed ?? "guest").trim();
  return value || "guest";
}

export function PixelAvatar({
  seed,
  alt = "avatar",
  size = 30,
  className = "",
}: PixelAvatarProps) {
  const normalizedSeed = normalizeSeed(seed);
  const backgroundColor =
    BACKGROUND_COLORS[
      hashString(`${normalizedSeed}-bg`) % BACKGROUND_COLORS.length
    ];
  const avatarSeed = `${normalizedSeed}-${hashString(`${normalizedSeed}-avatar`)}`;
  const imageSize = Math.max(size * 2, 64);
  const src = `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(avatarSeed)}&backgroundType=solid&backgroundColor=${backgroundColor}&size=${imageSize}`;

  return (
    <span
      className={className}
      style={{ width: size, height: size }}
      aria-hidden={alt ? undefined : true}
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  );
}
