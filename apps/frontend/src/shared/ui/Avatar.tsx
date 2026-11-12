import { AVATAR_PALETTE, DEFAULT_AVATAR_COLOR } from "../lib/avatarPalette";

type AvatarProps = {
  username: string;
  displayName?: string | null;
  avatarColor?: number | null;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "w-6 h-6 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-16 h-16 text-xl",
};

export function Avatar({ username, displayName, avatarColor, size = "md" }: AvatarProps) {
  const initial = (displayName || username).trim().charAt(0).toUpperCase();
  const color = AVATAR_PALETTE[avatarColor ?? DEFAULT_AVATAR_COLOR] ?? AVATAR_PALETTE[DEFAULT_AVATAR_COLOR];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}