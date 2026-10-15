import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-base font-bold tracking-tight">PallBi</span>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Zpět na úvod
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Ochrana osobních údajů</h1>
        <p className="mt-4 text-sm text-muted-foreground">Poslední aktualizace: 19. 8. 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold">1. Úvod</h2>
            <p className="mt-2 text-muted-foreground">
              Tato zásada ochrany osobních údajů popisuje, jak aplikace PallBi zpracovává osobní údaje svých uživatelů.
              Jsme transparentní, co se týče sběru dat, a dodržujeme předpisy o ochraně osobních údajů, zejména nařízení GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Správce osobních údajů</h2>
            <p className="mt-2 text-muted-foreground">
              Správcem osobních údajů je provozovatel aplikace PallBi. Pokud máte jakékoli dotazy týkající se zpracování
              vašich údajů, kontaktujte nás na e-mailu{" "}
              <a href="mailto:stepanpalla4@gmail.com" className="text-primary hover:underline">
                stepanpalla4@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Jaké údaje zpracováváme</h2>
            <p className="mt-2 text-muted-foreground">
              Při registraci a používání PallBi zpracováváme základní údaje uživatelského profilu, zejména:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>jméno a příjmení,</li>
              <li>e-mailovou adresu,</li>
              <li>informace o sportovních aktivitách a trénincích,</li>
              <li>tepové zóny a další tréninkové metriky.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Účel zpracování</h2>
            <p className="mt-2 text-muted-foreground">
              Vaše údaje používáme výhradně k poskytování funkcí tréninkového deníku – tedy k zobrazení, plánování a analýze
              tréninků, a k umožnění spolupráce mezi sportovcem a trenérem. Vaše data nikdy neprodáváme třetím stranám a
              nevyužíváme je k jiným účelům, než ke kterým slouží samotná aplikace.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Strava API</h2>
            <p className="mt-2 text-muted-foreground">
              Pokud se rozhodnete propojit svůj účet Strava, PallBi získává přes Strava API údaje o vašich aktivitách,
              jako jsou čas tréninku, vzdálenost, typ sportu, průměrná tepová frekvence a rozložení intenzitních zón.
              Tato data slouží výhradně k automatickému naplnění vašeho tréninkového deníku. Propojení je dobrovolné a
              můžete ho kdykoli zrušit v nastavení svého Strava účtu.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Google Ads konverzní sledování</h2>
            <p className="mt-2 text-muted-foreground">
              Na stránkách používáme měřicí kód Google Ads (konverzní tag AW-18395515009) k analýze efektivity naší
              reklamy. Tento kód nesbírá osobní údaje, které bychom mohli přímo spojit s konkrétní osobou, ale může
              zaznamenávat informace o vašich interakcích se stránkou. Sledování probíhá v souladu se zásadami Google.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Ukládání dat a zabezpečení</h2>
            <p className="mt-2 text-muted-foreground">
              Data jsou ukládána v cloudové databázi Supabase, která splňuje moderní bezpečnostní standardy. Přístup k
              údajům je chráněn autentizací, šifrováním přenosu a pravidly pro řízení přístupu (RLS). Děláme maximum pro
              to, aby vaše data byla bezpečná.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Vaše práva</h2>
            <p className="mt-2 text-muted-foreground">
              Máte právo na přístup k osobním údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost údajů a
              právo vznést námitku proti zpracování. Všechny žádosti můžete zaslat na e-mailovou adresu uvedenou níže.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. Kontakt</h2>
            <p className="mt-2 text-muted-foreground">
              Pokud máte jakékoli dotazy nebo požadavky týkající se ochrany osobních údajů, napište nám na{" "}
              <a href="mailto:stepanpalla4@gmail.com" className="text-primary hover:underline">
                stepanpalla4@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-4xl px-6 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy" className="hover:text-foreground">Ochrana osobních údajů</Link>
            <Link to="/terms" className="hover:text-foreground">Podmínky užívání</Link>
          </div>
          <p className="mt-4">© {new Date().getFullYear()} PallBi</p>
        </div>
      </footer>
    </div>
  );
}
