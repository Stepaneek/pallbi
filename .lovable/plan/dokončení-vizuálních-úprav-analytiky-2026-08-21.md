# Dokončení vizuálních úprav analytiky

Zbývající část předchozího zadání: sjednotit okraje karet a styl dropdownů i ve vnitřních sekcích analytiky.

## Co se změní

1. **Srovnání objemu** (`VolumeComparison.tsx`)
   - Karta dostane jemný tmavý okraj `dark:border-white/[0.08]`.
   - Dropdown (přepínač metriky) dostane `dark:bg-slate-800/80 dark:border-white/[0.08]`, aby byl zřetelně rozpoznatelný jako interaktivní prvek.

2. **Analytika střelby** (`ShootingAnalytics.tsx`)
   - Karty sekcí „Ležka“ a „Stojka“ dostanou stejný tmavý okraj.
   - Dropdown výběru období (týden/měsíc/sezóna) dostane stejný styl jako ostatní filtry.
   - Kontejner tabulky historie zásahů dostane sladěný okraj.

3. **Forma a únava** (`FitnessFatigue.tsx`)
   - Kontejner metrik/tabulky sladit se stejným okrajem (karta už okraj má).

## Technické detaily

Změny jsou pouze v Tailwind classNames existujících komponent, žádná logika, dotazy ani datové struktury se nemění.
