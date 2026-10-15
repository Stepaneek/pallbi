import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import poweredOrange from "@/assets/strava/powered-orange.svg.asset.json";
import poweredWhite from "@/assets/strava/powered-white.svg.asset.json";
import compatibleOrange from "@/assets/strava/compatible-orange.svg.asset.json";
import compatibleWhite from "@/assets/strava/compatible-white.svg.asset.json";

type Props = { variant?: "powered" | "compatible"; className?: string };

export default function StravaBadge({ variant = "powered", className }: Props) {
  const { theme } = useTheme();
  const compatible = variant === "compatible";
  const asset = compatible
    ? theme === "dark" ? compatibleWhite : compatibleOrange
    : theme === "dark" ? poweredWhite : poweredOrange;
  const label = compatible ? "Compatible with Strava" : "Powered by Strava";
  return (
    <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" aria-label={label}
      className={cn("inline-flex min-h-11 max-w-full items-center rounded-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", className)}>
      <img src={asset.url} alt={label} width={compatible ? 437 : 365} height={37}
        className={cn("block h-auto max-w-full object-contain", compatible ? "w-[262px]" : "w-[219px]")} />
    </a>
  );
}
