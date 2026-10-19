import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-canvas">
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
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Podmínky užívání</h1>
        <p className="mt-4 text-sm text-muted-foreground">Poslední aktualizace: 19. 8. 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold">1. Úvod</h2>
            <p className="mt-2 text-muted-foreground">
              Tyto podmínky užívání upravují používání webové aplikace PallBi (dále jen „služba"). Používáním služby
              potvrzujete, že jste se s těmito podmínkami seznámili, rozumíte jim a souhlasíte s nimi.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Popis služby</h2>
            <p className="mt-2 text-muted-foreground">
              PallBi je online tréninkový deník pro vytrvalostní sportovce a jejich trenéry. Umožňuje plánovat a zaznamenávat
              tréninky, synchronizovat aktivity ze Stravy, sledovat tréninkovou zátěž podle intenzitních zón a analyzovat
              výkon v čase.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Registrace a účet</h2>
            <p className="mt-2 text-muted-foreground">
              Pro plné využití služby je nutná registrace uživatelského účtu. Při registraci se zavazujete poskytnout
              pravdivé a úplné informace. Máte odpovědnost za zabezpečení svého hesla a za veškerou aktivitu, která probíhá
              pod vaším účtem. Pokud zjistíte neoprávněné použití svého účtu, kontaktujte nás co nejdříve.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Uživatelské povinnosti</h2>
            <p className="mt-2 text-muted-foreground">
              Uživatel se zavazuje používat službu v souladu s platnými právními předpisy, nešířit škodlivý obsah a neohrožovat
              bezpečnost a stabilitu aplikace. Dále nesmí zneužívat automatizované nástroje k extrahování dat ani překračovat
              limity určené pro bezplatné či placené uživatele.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Dostupnost služby</h2>
            <p className="mt-2 text-muted-foreground">
              Službu se snažíme udržovat dostupnou 24 hodin denně, 7 dní v týdnu. Vyhrazujeme si však právo na přerušení
              provozu z důvodu údržby, aktualizací nebo vyšší moci. Neručíme za nepřerušenou dostupnost služby a neodpovídáme
              za škody způsobené dočasným výpadkem přístupu.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Změny a ukončení</h2>
            <p className="mt-2 text-muted-foreground">
              Podmínky užívání můžeme kdykoli aktualizovat. O významných změnách vás budeme informovat prostřednictvím
              aplikace nebo e-mailu. Máte právo svůj účet kdykoli smazat v nastavení profilu; smazáním účtu dojde k odstranění
              vašich osobních dat v souladu se zásadami ochrany osobních údajů.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Odpovědnost</h2>
            <p className="mt-2 text-muted-foreground">
              PallBi slouží jako pomůcka pro záznam a analýzu tréninku. Neručíme za zdravotní stav uživatele ani za správnost
              interpretace tréninkových dat. Před zahájením jakéhokoli náročnějšího tréninkového programu doporučujeme konzultaci
              s lékařem nebo kvalifikovaným trenérem.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Kontakt</h2>
            <p className="mt-2 text-muted-foreground">
              Dotazy týkající se těchto podmínek směřujte na{" "}
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
