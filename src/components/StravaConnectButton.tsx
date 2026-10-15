import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import connectOrange from "@/assets/strava/connect-orange.svg.asset.json";

export default function StravaConnectButton({ className, ...props }: Omit<ButtonProps, "children" | "variant" | "size" | "asChild">) {
  return (
    <Button {...props} variant="strava" aria-label="Connect with Strava"
      className={cn("h-auto w-[237px] max-w-full shrink-0 overflow-hidden rounded-md p-0", className)}>
      <img src={connectOrange.url} alt="Connect with Strava" width={237} height={48} className="block h-auto w-full object-contain" />
    </Button>
  );
}
