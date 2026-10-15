import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { LANGUAGES } from "@/i18n";
import { Activity, Target, LineChart, Share2, UsersRound, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import FaqSection from "@/components/landing/FaqSection";


const StravaIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L12.56 0 5.579 12.343h4.172l1.628-3.066" />
  </svg>
);

const audience = [
  { icon: UsersRound, key: "coaches" },
  { icon: Activity, key: "athletes" },
  { icon: Users, key: "clubs" },
];

const how = [
  { icon: StravaIcon, key: "sync", colorClass: "text-[#FC4C02]" },
  { icon: Target, key: "zones", colorClass: "text-primary" },
  { icon: Share2, key: "share", colorClass: "text-primary" },
  { icon: LineChart, key: "analytics", colorClass: "text-primary" },
];

export default function Landing() {
  const { t, i18n } = useTranslation();

  /** Localized head metadata + canonical for /, /sk, /en, /de, … */
  useEffect(() => {
    const code = i18n.language?.slice(0, 2) ?? "cs";
    const lang = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
    document.title = t("landing.title");
    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', "content", t("seo.description"));
    setMeta('meta[property="og:title"]', "content", t("landing.title"));
    setMeta('meta[property="og:description"]', "content", t("seo.description"));
    setMeta('meta[property="og:locale"]', "content", lang.ogLocale);
    const url = lang.code === "cs" ? "https://pallbi.app/" : `https://pallbi.app/${lang.code}`;
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[property="og:url"]', "content", url);
  }, [t, i18n.language]);


  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #152642 50%, #1E3A5F 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 22px)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 20% 30%, rgba(59,130,246,0.25), transparent 55%)" }}
        />
        <svg
          className="pointer-events-none absolute -bottom-20 -right-20 hidden h-[460px] w-[460px] text-white/[0.05] md:block"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="90" />
          <circle cx="100" cy="100" r="65" />
          <circle cx="100" cy="100" r="40" />
          <circle cx="100" cy="100" r="15" />
          <circle cx="100" cy="100" r="3" fill="currentColor" stroke="none" />
          <line x1="100" y1="0" x2="100" y2="30" />
          <line x1="100" y1="170" x2="100" y2="200" />
          <line x1="0" y1="100" x2="30" y2="100" />
          <line x1="170" y1="100" x2="200" y2="100" />
        </svg>

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold tracking-tight">PallBi</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <LanguageSwitcher syncUrl className="text-white hover:bg-white/15 hover:text-white" />
            <Button asChild variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-8 text-white md:pb-28 md:pt-14">
          <p className="text-3xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {t("landing.heroKicker1")}{" "}
            <span className="bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent">{t("landing.heroKicker2")}</span>{" "}
            {t("landing.heroKicker3")}
          </p>

          <h1 className="mt-6 text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            {t("landing.title")}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            {t("landing.intro")}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth?mode=signup">{t("landing.ctaFree")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* PRO KOHO */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("landing.audienceTitle")}</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {audience.map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <h3 className="text-base font-semibold">{t(`landing.audience.${key}Title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.audience.${key}Text`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* JAK FUNGUJE */}
      <section className="border-y bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("landing.howTitle")}</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {how.map(({ icon: Icon, key, colorClass }) => (
              <div key={key} className="flex gap-4 rounded-xl border bg-card p-6 shadow-sm">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${colorClass}`} strokeWidth={2.25} />
                <div>
                  <h3 className="text-base font-semibold">{t(`landing.how.${key}Title`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(`landing.how.${key}Text`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UKÁZKA FUNKCÍ */}
      <FeatureShowcase />

      {/* CENA */}

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("landing.priceTitle")}</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-7 shadow-sm">
            <h3 className="text-lg font-semibold">{t("landing.price.freeTitle")}</h3>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{t("landing.price.freeAmount")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("landing.price.freeNote")}</p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> {t("landing.price.freeF1")}</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> {t("landing.price.freeF2")}</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> {t("landing.price.freeF3")}</li>
            </ul>
          </div>
          <div className="rounded-xl border-2 border-primary bg-card p-7 shadow-sm">
            <h3 className="text-lg font-semibold">{t("landing.price.proTitle")}</h3>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">
              {t("landing.price.proAmount")} <span className="text-base font-medium text-muted-foreground">{t("landing.price.proPeriod")}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("landing.price.proNote")}</p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> {t("landing.price.proF1")}</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> {t("landing.price.proF2")}</li>
              <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> {t("landing.price.proF3")}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth?mode=signup">{t("landing.ctaFree")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">{t("nav.signIn")}</Link>
          </Button>
        </div>
      </section>

      <FaqSection />

      <footer className="border-t py-8">

        <div className="mx-auto max-w-6xl px-6 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy" className="hover:text-foreground">Ochrana osobních údajů</Link>
            <Link to="/terms" className="hover:text-foreground">Podmínky užívání</Link>
          </div>
          <p className="mt-4">© {new Date().getFullYear()} {t("landing.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
