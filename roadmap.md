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

## Světlý režim: výraznější kontrast — hotovo
- [x] Nový token --canvas = #E2E8F0 (šedé pozadí aplikace); --background zůstává bílý pro povrchy (inputs, dialogy, popisky, záložky)
- [x] Tělo stránky (body) + AppShell, Auth, AcceptInvite, Terms, Privacy používají bg-canvas
- [x] --border/--input = #CBD5E1 (slate-300), karty bílé s viditelným okrajem a středně silným stínem (.card-shadow)
- [x] Týdenní tabulka: bílé tělo, šedé hlavičky (bg-muted), šedý nádech sloupce Celkem, zaoblení + shadow-md
- [x] Popisek VOLNÁ v grafech čitelný (--zone-volna v light = #94A3B8)
- [x] Ověřeno v náhledu (light: body #E2E8F0, karta bílá s #CBD5E1; dark beze změny) + typecheck čistý

## Logo Stravy v patičce — oranžové i v tmavém režimu — hotovo
- [x] Nové assety powered-orange-dark.svg / compatible-orange-dark.svg (oficiální logo, jen popisek bíle místo černé, slovo STRAVA zůstává oficiální oranžová #FC5200)
- [x] StravaBadge používá v tmavém režimu tyto varianty (dřív čistě bílé), ve světlém bez změny
- [x] Ověřeno: tmavý režim volí new asset, raster na tmavém pozadí = bílý popisek + oranžové STRAVA; typecheck čistý

## Revize UX (bez 1A)
- [x] Lišta svěřenců s iniciálami a tečkou stavu dneška (Týden, Střelba)
- [x] Zkratky T (dnes) a P (plán/skutečnost) v Týdnu
- [x] Vibrace při zápisu rány na terči (mobil)
- [x] EN překlad „Ø čas 1. rány"
- [x] Vybraný sportovec je sdílený napříč záložkami (už existovalo)
- [x] Odznak Stravy u spárovaných bloků (už existovalo)
- [ ] Synchronizovaný crosshair + mini-karta v tooltipu + filtry 30/90 dní v Analytice
- [ ] Týmový denní checklist v Týmu
- [ ] Kopírování tréninku do jiného dne/sportovce, šablony pro skupinu
- [ ] Optimistické ukládání s Ctrl+Z
- [ ] Celoobrazovkový režim terče, tmavší texty pastelových štítků ve světlém režimu
