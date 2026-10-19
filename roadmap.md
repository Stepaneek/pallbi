# Roadmap

## UX vylepšení: dnešek, prázdné stavy, skeletony — hotovo
- [x] Zvýraznění dnešního dne v týdenním přehledu (Week day strip: jemný modrý obrys + pozadí, když není vybraný; WeeklyPlanOverview: modrý okraj karty)
- [x] Komponenta EmptyState (ikona, text, akce) — Tým (pozvání sportovce), Historie střelby („Přidat první záznam"), Analytika (donut bez dat); i18n cs/en (zeroing.emptyAction)
- [x] Skeleton loadery — Week (přepínání týdnů), Tým (karty), Historie střelby (řádky), Analytika (statistiky + grafy Forma/Kilometry)
- [x] Ověřeno v náhledu (dnešek nevybraný i vybraný, prázdná historie střelby) + typecheck čistý + build OK

## Modernizační redesign UI/UX — hotovo
- [x] Karty: jemnější okraj, rounded-2xl, měkký stín (tokeny + card.tsx)
- [x] Tmavý režim: jemnější, téměř neviditelný okraj karet
- [x] Tlačítka: primární gradient + glow při hoveru (button.tsx, .btn-primary)
- [x] Přepínače: Tabs a Plán/Skutečnost uhlazenější (tabs.tsx, Week.tsx)
- [x] Typografie: výraznější nadpisy (text-3xl), tabular-nums statistiky (.stat-number, pallbi-table)
- [x] Ověřeno v náhledu (light/dark) + typecheck čistý

## Graf „Kilometry v čase" — vzhled sloupců — hotovo
- [x] Zaoblení jen jako čepička celého sloupce (radius 4): každý dílek je obyčejný obdélník, celý sloupec se ořízne clipPathem — vnitřní spoje ostré, tenký horní dílek se neslije do bobulky
- [x] Mezery mezi týdny (barCategoryGap + maxBarSize), segmenty u sebe bez spár
- [x] Pastelové barvy ze 2. verze zachovány beze změny
- [x] Ověřeno v náhledu (29 sloupců, všechny s čepičkou, spoje ploché) + typecheck čistý
