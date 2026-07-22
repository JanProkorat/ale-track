# Prototype fidelity pass

Goal: every screen is a **precise copy** of the interactive prototype.

Ground truth (saved locally, do not commit): the prototype HTML at
`~/.claude/projects/-Users-jan-Projects-ale-track/d89dbeb5-.../tool-results/artifact-275dd5e7-1784463390-74b0.html`
Re-fetch with WebFetch on `https://claude.ai/code/artifact/275dd5e7-449e-4fdc-a0e5-13e06f76e06a` if lost.

## Prototype view functions (line numbers in that file)
- Shell/nav/topbar/account/currency: 686–970
- Dashboard `viewDashboard`: 828–971 (tiles + "tento týden" + low-stock + reminders + driver availability)
- Breweries `viewBreweries`/`breweriesModule`: 1039–1258 ✅ DONE (matches)
- Clients `viewClients`/`viewClientDetail`: 1259–1389 (region grouping + maps + merged Info/Kontakty)
- Orders `viewOrders`/`viewOrderDetail`/`viewOrderEditor`: 1390–1625 (history-first builder)
- Route map SVG: 1626–1690
- Shipments `viewShipments`/detail/editor + nakládka: 1691–1949
- Deliveries `viewDeliveries`/detail/editor: 1950–2170
- Inventory `viewInventory`: 2171–2286 (stat bar w/ inline controls, list/grid)
- Drivers `viewDrivers` + calendar: 2287–2366
- Vehicles `viewVehicles`: 2367–2398
- Users `viewUsers` + permission matrix: 2399–2462
- Command palette: 2464–2512
- Login `renderLogin`: 2514–2567

## Order of work (commit each)
1. Shell/topbar/nav parity (nav count badges, topbar controls) — audit
2. Fidelity fixes to built screens: Vozy, Uživatelé, Sklad, Řidiči
3. Build precise: Klienti, Objednávky, Vývozy, Dovozy (+ their demo data: clients, orders, shipments, deliveries, reminders, exchange rates)
4. Dashboard final pass (needs orders/shipments/deliveries data → do LAST)
5. P13: tests, README, CLAUDE.md

## Rules
- Match the prototype structure/labels/control placement exactly.
- Keep the data-source seam + hooks; only change presentation.
- Czech UI; MUI kit; never touch backend/secret files; verify + commit surgically.
