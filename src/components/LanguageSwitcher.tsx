import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { LANGUAGES, type LanguageCode } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Language switcher. On the public landing page it also rewrites the URL
 * (/, /sk, /en) so each language has its own indexable path.
 */
export default function LanguageSwitcher({ syncUrl = false, className }: { syncUrl?: boolean; className?: string }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const current = (i18n.language?.slice(0, 2) ?? "cs") as LanguageCode;
  const active = LANGUAGES.find((l) => l.code === current) ?? LANGUAGES[0];

  const change = (code: LanguageCode) => {
    i18n.changeLanguage(code);
    if (syncUrl) {
      const target = code === "cs" ? "/" : `/${code}`;
      if (location.pathname !== target) navigate(target, { replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5 px-2", className)} aria-label="Language">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold">{active.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => change(l.code)}
            className={cn("gap-2", l.code === current && "font-semibold text-primary")}
          >
            <span aria-hidden>{l.flag}</span>
            {l.name}
            <span className="ml-auto text-xs text-muted-foreground">{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
