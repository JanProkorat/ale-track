# AleTrack — Fresh-Eye Redesign Prototype (Design Doc)

**Date:** 2026-07-19
**Type:** Interactive design prototype (self-contained HTML artifact, mock data)
**Goal:** Evaluate a fresh redesign of the AleTrack web app covering all 9 modules,
before committing to a production rebuild. Not production code.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Deliverable | Single self-contained interactive HTML file, published as an Artifact |
| Visual identity | Amber/beer-forward (`#F08C00`) + navy (`#1E2A3A`) + slate neutrals |
| Scope | All 9 modules, fully interactive on mock data |
| Language | Czech UI (enum values mapped to Czech display strings) |
| Fonts | System stack evoking Barlow (headings) / DM Sans (body) — CDN fonts blocked in artifacts |
| Logo | Beer-glass mark recreated as inline SVG (amber beer, navy outline, cream foam) |
| Themes | Light + dark, toggleable |

## Visual system

- **Brand accent:** amber `#F08C00`, hover `#C77700`, tint `#FDE9CE`.
- **Shell:** navy `#1E2A3A` sidebar; slate scale `#0F172A`→`#F8FAFC`; warm off-white canvas, cream `#F5F0E1` accents.
- **Semantic status palette** (from existing theme): success `#16A34A`, info `#0891B2`, warning `#EAB308`, error `#EF4444`.

### Enum → Czech label + color mapping

- **OrderState:** New=Nová (grey) · Planning=Plánuje se (info) · Delivering=Rozváží se (amber) · Finished=Dokončeno (success) · Cancelled=Zrušeno (error)
- **OutgoingShipmentState:** Created=Vytvořeno · Loaded=Naloženo · InTransit=Na cestě · Delivered=Doručeno · Cancelled=Zrušeno
- **ProductDeliveryState:** InPlanning=Plánuje se · OnTheWay=Na cestě · Finished=Dokončeno · Cancelled=Zrušeno
- **ProductKind:** Keg=Sud · Bottle=Láhev · Can=Plechovka · Multipack=Multipack · Other=Ostatní
- **Region:** Zittau/Görlitz/Chemnitz/Leipzig/Berlin/Freiberg/… (border region)

## Navigation & shell

Navy collapsible left sidebar, grouped:
- **Nástěnka** (dashboard)
- **Prodej:** Objednávky · Vývozy
- **Sklad:** Dovozy zboží · Sklad
- **Evidence:** Pivovary · Klienti · Řidiči · Vozy
- **Správa:** Uživatelé (admin only)

Top bar: global search · reminder bell (brewery + client + order-item reminders) · user menu · light/dark toggle.

**Dashboard:** 9 module count-tiles (reports endpoint), upcoming-reminders panel, this-week shipments & imports, quick actions.

## Workflow improvements over current backend (approved)

1. **Granular permissions (Users):** full permission matrix (module × view/edit/custom-actions), beyond the BE's Admin/User binary.
2. **Order product picker — history-first:** opens on "Dříve objednané" per client (`products/client/{id}/history`), then browse by brewery/kind/package-size.
3. **Vývozy route map:** interactive stylized SVG map (Zittau/Görlitz/Liberec region), drag-to-reorder stops, "optimalizovat trasu", live route + distance/time recalculation, official-vs-contact address per stop.
4. **Price updates:** bulk price-update flow with effective date ("ceny se pravidelně mění").
5. **Dovoz → Sklad propagation:** stock write-through preview on marking a Dovoz "Dokončeno".
6. **Sklad traceability:** grouped by brewery/kind, low-stock flags, inline qty edits, manual add/remove, in/out source.
7. **Drivers availability calendar** + reminders notification center as first-class views.

## Module screens (all interactive, mock data)

Each module: filterable list view + detail/form view.
- **Pivovary:** list (color chips) → detail tabs: Info / Ceník (products by kind, bulk price update) / Připomínky / Poznámky.
- **Klienti:** list (region) → detail tabs: Info / Kontakty / Objednávky / Připomínky / Poznámky.
- **Objednávky:** list (status, planningState filter) → builder with history-first product picker, per-item qty, delivery date, note.
- **Vývozy:** list → planner: select orders → route map + reorderable stops + vehicle/drivers + extra items + loading confirmation.
- **Dovozy zboží:** list → multi-brewery stops, drivers/vehicle, status flow, stock write-through on finish.
- **Sklad:** grouped inventory, low-stock flags, inline qty edit, manual add/remove.
- **Řidiči:** list + availability calendar (color per driver).
- **Vozy:** list + form (name, max weight).
- **Uživatelé:** list + form with permission matrix (admin).

## Build approach

One self-contained HTML file: hash-router, in-memory mock store seeded from realistic
data matching the real entities/enums (GUID ids, string enums), vanilla JS components,
inline SVG logo + map + icons, light/dark via `data-theme`. Published as an Artifact.

## Out of scope

Real API calls, auth, persistence, real map tiles, production React. This is a
click-through design prototype for evaluating the redesign.
