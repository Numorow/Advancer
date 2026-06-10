import { avatarHue, initialsFor } from "@/lib/presence/avatars";
import { cn } from "@/lib/utils";

/**
 * Profile avatar: photo when available, otherwise initials on a deterministic
 * per-user hue. `online` controls the status treatment — undefined hides the
 * dot entirely (e.g. members list), true/false shows green / grey-offline.
 */
export function Avatar({
  userId,
  name,
  email,
  avatarUrl,
  online,
  size = 32,
  className,
}: {
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  online?: boolean;
  size?: number;
  className?: string;
}) {
  const offline = online === false;
  const hue = avatarHue(userId);
  return (
    <span
      className={cn("relative inline-block shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          className={cn(
            "h-full w-full rounded-full object-cover ring-2 ring-[var(--card)]",
            offline && "opacity-50 grayscale",
          )}
        />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full font-semibold text-white ring-2 ring-[var(--card)]",
            offline && "opacity-50 grayscale",
          )}
          style={{
            backgroundColor: `hsl(${hue} 45% 42%)`,
            fontSize: Math.max(10, Math.round(size * 0.36)),
          }}
        >
          {initialsFor(name, email)}
        </span>
      )}
      {online === true && (
        <span
          className="absolute -bottom-0.5 -right-0.5 block rounded-full bg-[var(--success)] ring-2 ring-[var(--card)]"
          style={{ width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }}
        />
      )}
    </span>
  );
}
