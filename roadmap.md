# Roadmap

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
