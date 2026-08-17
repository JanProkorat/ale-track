# Client-specific product prices

A client can have a set of custom product prices that applies to all of their
orders. The rule stays live and relational; the price it resolves to freezes on
the invoice line it was charged on — so repricing affects future invoices and
never restates a past one.

`OutgoingShipmentInvoiceLine.UnitPriceWithVat` was written with exactly this
feature in mind and already documents the intent in its own remarks. This design
fills in the rule side that comment anticipated.

> **Revised 2026-08-17**, re-checked against the code after price-list import,
> explicit packaging, role-capability config and Garážový prodej landed. The data
> model, the resolver and the freeze semantics survived unchanged. What changed:
> the charged-vs-catalog field is named `ListPriceWithVat` after the precedent
> garage sales set (#the-name-listpricewithvat), counter sales joined the surface
> inventory (#counter-sales), the write routes are now a documented deviation
> rather than a mirror (#api-surface), the Ceník lands in a tabbed
> ClientDetail (#ceník-tab-on-clientdetail), and bulk price-list imports reopened
> the staleness question (#staleness-after-a-price-list-import).
>
> The four questions that revision opened were **settled on 2026-08-17** and are
> written into the sections below as decisions: an override pre-fills counter-sale
> lines and wins over the last-sold price on both segments of the sale catalog; the
> Ceník gets its own fifth tab on ClientDetail; and `set_on` lands as a column now
> with its staleness marker deferred.
>
> **Added 2026-08-17:** bulk editing over the whole catalog
> (#bulk-editing-over-the-catalog), which takes a percentage against the ceník *or*
> exact amounts per row and saves both under one button. It changes no stored shape —
> the two Out of scope entries it touches are narrowed to "as a stored rule" rather
> than dropped.

## Data model

New entity `ClientProductPrice` → table `client_product_prices`.

| column | type | notes |
|---|---|---|
| `client_id` | `long` FK | Cascade — deleting a client drops its price list |
| `product_id` | `long` FK | **Restrict** |
| `price_with_vat` | `decimal` | The only operator-entered value |
| `set_on` | `DateOnly` | Set server-side on every write — see #staleness-after-a-price-list-import |

`set_on` is **provenance, not a rule**: it records when someone last decided this
price, and nothing reads it to determine whether the override applies. Validity
date ranges stay out of scope, which is why this is not called
`price_effective_from` despite being compared against the product's field of that
name — a reader who saw that name here would reasonably assume the override only
takes effect from that date.

Unique index on `(client_id, product_id)` — one price per client per product.

`product_id` is `Restrict`, not the EF default `Cascade`, for the reason
established for `OrderItem.Product` (commit 4764968): a product must not be
deletable out from under rows that reference it without the caller noticing.

The base class is `PublicEntity` — **not** softly deletable. Removing an override
reverts the client to the catalog price, and it cannot rewrite history, because
every invoice line already froze its own `UnitPriceWithVat` at billing time. A
soft-delete flag here would carry no information anything reads.

New navigation on `Client`:

```csharp
/// <summary>
/// Custom product prices that apply to every order from this client
/// </summary>
public List<ClientProductPrice> ProductPrices { get; set; } = [];
```

Register the `DbSet` on `AleTrackDbContext` and add an EF configuration under
`Infrastructure/Persistence/Configurations/` carrying the unique index.

## Resolution

One helper: `Common/Utils/ClientPriceResolver.cs`, alongside the existing
cross-feature `ProductOrdering.cs`. Two parts:

- `LoadAsync(dbContext, clientId, ct)` → `ClientPriceList`, a dictionary
  `productId → priceWithVat`.
- `ClientPriceList.Resolve(product)` → the four effective price fields.

### The formula

Only `PriceWithVat` is stored. The other three are scaled from the product's own
ratios — the same approach `BulkPriceDrawer.tsx:79-81` already takes on the
frontend when bulk-repricing a brewery:

```
ratio = override / product.PriceWithVat

PriceWithVat            = override
PriceWithoutVat         = product.PriceWithoutVat        * ratio
PriceForUnitWithVat     = product.PriceForUnitWithVat    * ratio
PriceForUnitWithoutVat  = product.PriceForUnitWithoutVat * ratio
```

Money rounds to 2 decimals. Null source fields stay null.

Deriving from the product's own ratio rather than a hardcoded `1.21` divisor
keeps each product's real effective VAT rate intact.

**Edge case — a product priced at zero.** The ratio is undefined. `PriceWithVat`
takes the override; the three derived fields keep the product's own values. This
is the same resolution `BulkPriceDrawer.tsx:79` reaches by falling back to
`ratio = 1`, so the two paths agree without either referencing the other.

### Why a lookup rather than a SQL LEFT JOIN

`ShipmentContentSnapshotWriter` is deliberately DbContext-free — its remarks say
so, and that property is what lets it run inside a state transition without
touching persistence. A lookup can be passed into it; a JOIN in a projection
cannot. Using the lookup form everywhere gives one implementation and one test
suite across every path, and a client's override list is a handful of rows.

Constraint to record: no current query filters or sorts by price. If one ever
does, applying the override after projection would desync from that sort, and
that path needs the JOIN form instead.

Concretely, in `GetProductsByClientHistoryEndpoint` the override is applied to
the materialised list **after** `ToListAsync()` — `ApplyFilterAndSort` runs
server-side against catalog prices, which is exactly why the constraint above
matters.

## Where prices surface

The complete inventory of price surfaces in the product, and what each needs.

| surface | source today | change |
|---|---|---|
| `ShipmentContentSnapshotWriter.Snapshot()`:80 | `product.PriceWithVat` | **Resolve here** — the load-bearing change |
| `ShipmentInvoicing.tsx` | invoice lines ← stop-item snapshot | None — inherits the above |
| `GetProductsByClientHistoryEndpoint`:75 | `p.PriceWithVat` | Resolve; already client-scoped by route |
| Order detail item rows | *no price at all today* | New price fields on `OrderItemDto` (`OrderDto.cs:96`) |
| `SaleEditor.tsx:236` — counter-sale line default | `suggestedPrice ?? row.priceWithVat` | Resolve the stock row's price — see #counter-sales |
| `SaleCatalog.tsx:462` — "Dříve prodané" add | suggests `lastUnitPriceWithVat` | Suggest the override instead; keep displaying the last paid price |
| `SaleLineWriter`:61 — persisting a sale line | operator-typed `dto.UnitPriceWithVat` | None — the price arrives resolved from the client |
| `breweries/Cenik.tsx`, `BulkPriceDrawer.tsx` | catalog | None — brewery-owned, not client-scoped |
| Reports — orders/volume | — | None; these carry no money |
| Reports — `GarageSalesRevenueReportDto` | `SaleItem.UnitPriceWithVat` | None — reads the frozen line, not the rule |

The original table's "Reports — none; reports carry no money" no longer holds:
the garage-sale revenue report does carry money. It needs no change regardless,
because it reads the frozen `SaleItem` line rather than resolving anything, but
the blanket claim was wrong and is worth not inheriting.

### The name `ListPriceWithVat`

This design originally called the catalog price carried beside a charged one
`CatalogPriceWithVat`. Garage sales shipped first and named the same concept
`ListPriceWithVat` — `SaleItem.ListPriceWithVat`, kept alongside
`SaleItem.UnitPriceWithVat` so a discount given at the counter stays visible
after the fact. That is this feature's charged-vs-catalog pair, already in the
schema under a different word.

So **`ListPriceWithVat` is the name everywhere** — the new DTO fields below, and
the frontend `listPriceWithVat`. Two names for one idea costs more than the rename
does, and `SaleItem` has the prior claim.

### Freeze semantics

The resolved price lands on the stop-item snapshot at the transition into
`Loaded`, which is the same boundary `ShipmentMutability` freezes content at.
Consequences, which are the intended behaviour:

- Editing a client's price affects every order not yet loaded.
- An order already loaded and invoiced is untouched.

### Order detail reads the snapshot when one exists

For an order that has already been loaded, an item row shows the **frozen**
snapshot price, not the live-resolved one. Otherwise a delivered order would
display a price different from the invoice the client received. This follows the
principle already committed in issue #25 — historical records stop reading live
data. Orders not yet loaded resolve live.

So `OrderItemDto.UnitPriceWithVat` is filled from the item's
`OutgoingShipmentStopItem.UnitPriceWithVat` when a snapshot row exists (reachable
via `OutgoingShipmentStopItem.OrderItemId`), and from `ClientPriceResolver`
otherwise.

`ListPriceWithVat` stays **null for snapshot-fed rows**. The snapshot never
recorded what the catalog price was at the time, and putting today's catalog
price beside a frozen one would be actively misleading. The practical effect is
that the "special price" marker shows on orders still being composed and drops
away once the order is loaded — which is correct: at that point the frozen number
is the whole truth.

### Counter sales

Garážový prodej did not exist when this was written, and it sells to clients:
`Sale.BuyerKind` is `SaleBuyerKind.Client` exactly when `Sale.ClientId` is
non-null, the other case being a walk-in identified only by `BuyerName`. So a
client override has a claim on counter-sale lines too, and two things about how
sales already work make this more than a mechanical extension.

First, **the price on a sale line is operator-typed, not resolved.**
`SaleLineWriter.BuildLinesAsync` takes `dto.UnitPriceWithVat ?? 0m` from the
request and snapshots `stock.Product?.PriceWithVat` beside it as
`ListPriceWithVat`. There is no server-side pricing rule to intercept; whatever
happens has to happen as a *default* offered to the operator, who stays free to
type over it.

Second, **there is already an informal per-client price memory.**
`GetSaleClientHistoryEndpoint` feeds the sale editor's "Dříve prodané" tab with
`LastUnitPriceWithVat` per stock item — the price this client last actually paid.
That is a competing answer to "what should this line cost for this client", built
from history rather than from a rule.

**Decided: an override pre-fills counter-sale lines, and it wins on both segments
of the sale catalog.** For `BuyerKind.Client`, a line added from either "Procházet
sklad" or "Dříve prodané" defaults to the client's override; the operator stays
free to type over it. The "Dříve prodané" row keeps *displaying* what the client
last paid — that is the point of the segment — but adding from it inserts the
override. One product must not carry two different prices depending on which
segment it was added from; an operator cannot reasonably be asked to track that.

The rule wins over the last paid price because a decision outranks an observation.
`GetSaleClientHistoryEndpoint` needs no change: it keeps reporting
`LastUnitPriceWithVat` as the historical fact it already is.

The seam for this already exists and is narrow. `SaleCatalog`'s
`onAdd(row, suggestedPrice?, suggestedQuantity?)` is called with a suggested price
on the history path (`SaleCatalog.tsx:462`) and without one on the browse path
(`:485`), and `SaleEditor.tsx:236` resolves the line default as
`suggestedPrice ?? row.priceWithVat ?? null`. So the whole change is: resolve the
stock row's `priceWithVat` against the client's overrides, and pass the override
rather than `lastUnitPriceWithVat` on the history path. No new plumbing, no change
to how a line is persisted.

Walk-ins are unaffected by construction — `showHistory` is false without a saved
client, and there is no client whose overrides could resolve.

The freeze side needs no new machinery either: `SaleItem` already carries
`UnitPriceWithVat` and `ListPriceWithVat`, so a sale line records what was charged
and what the catalog said, exactly as an invoice line does.

## API surface

New slice `Features/ClientProductPrices/`, mirroring `Features/ClientDeliveryPlaces/`:
`.RequirePermission(ModuleType.Clients, …)` inside `Description(b => …)`,
`ThrowHelper.PublicEntityNotFound`, `DontCatchExceptions()`.

Endpoints are **`internal sealed`**, not the `public sealed` this originally said.
`ClientDeliveryPlaces` is `public sealed`, but every slice added since — the whole
of `Features/Sales/`, for instance — is `internal sealed`, which is also what the
pack's C# rules call for. Follow the newer convention rather than the older
neighbour.

| endpoint | route | permission |
|---|---|---|
| `GetClientProductPricesEndpoint` | `GET clients/{ClientId:guid}/product-prices` | `Clients` / `View` |
| `SaveClientProductPriceEndpoint` | `PUT clients/{ClientId:guid}/product-prices/{ProductId:guid}` | `Clients` / `Edit` |
| `DeleteClientProductPriceEndpoint` | `DELETE clients/{ClientId:guid}/product-prices/{ProductId:guid}` | `Clients` / `Edit` |

`PUT` is an upsert. There is one value per `(client, product)` pair, so a
create/update split would add a 409 path and buy nothing.

**The write routes are a deliberate deviation, not a mirror.**
`ClientDeliveryPlaces` keys its writes off the row's own `PublicId` and flattens
the route to match — `POST clients/{id}/delivery-places`, then
`PUT`/`DELETE clients/delivery-places/{Id:guid}`. The compound
`{ClientId}/product-prices/{ProductId}` form above departs from that on purpose:
the pair *is* the key here, and an upsert has no row id to address before the row
exists. Requiring the caller to look up a `PublicId` first — or to branch between
POST and PUT — would buy nothing but a round trip. Worth stating explicitly so a
reviewer reads it as a decision rather than as drift from the sibling slice.

The list query filters out soft-deleted products (`!p.IsDeleted`), so a price
pointing at a removed product stops appearing in the Ceník tab. The row itself
survives — `product_id` is `Restrict`, and nothing benefits from deleting it.

A validator on the save request enforces `PriceWithVat` is present and greater
than zero.

### DTO changes

Both additive and non-breaking:

- `ProductListItemDto` gains `ListPriceWithVat: decimal?` — non-null **only**
  when an override applies. `PriceWithVat` keeps meaning "the effective price",
  so existing consumers keep working, and a non-null `ListPriceWithVat` is
  the signal that this row is a special price. On the global product list, where
  no client is in scope, it is always null.
- `OrderItemDto` (nested in `OrderDto.cs:96`) gains `UnitPriceWithVat: decimal`
  and `ListPriceWithVat: decimal?`.

Note that `ProductListItemDto` carries `PriceWithVat`, `PriceForUnitWithVat` and
`PriceForUnitWithoutVat` but **no `PriceWithoutVat`** — the resolver computes four
fields, and only three of them have anywhere to go on this DTO. Nothing needs the
fourth today; if the Ceník tab or the OrderEditor ends up wanting a without-VAT
figure, adding it is a separate additive change, not something to slip in here.

These are backend DTO changes, so `yarn generate-api` and its frontend
consumption land in the same commit.

## UI

### Ceník tab on ClientDetail

Each row shows the product name, its brewery, the client price, and the list price
as secondary. Adding a row uses the existing brewery-grouped `ProductCombobox`
from #25. Gated on `canEdit('clients')`. Mobile gets the `mobileCard` treatment
used by the other client collections.

What changed: **ClientDetail is tabbed now**, so "a `CollapsibleCard` following
the Kontakty / Dodací místa pattern" no longer names one place. `clientDetailTab.ts`
narrows a `?tab=` URL param to `'info' | 'orders' | 'reminders' | 'notes'`, and the
Dodací místa card sits inside the `info` tab (`ClientDetail.tsx:215`) next to
Kontakty.

**Decided: the Ceník gets its own fifth tab**, with a count pill like Objednávky
and Připomínky carry. A client's price list is expected to be long enough to want
the width, and the pill advertises that overrides exist without anyone expanding a
card to find out.

That means widening `SubTab` in `clientDetailTab.ts` to include the new value,
adding it to `SUB_TABS` so a `?tab=` param narrows to it, extending
`clientDetailTab.test.ts`, and adding the `Tab` plus its render branch in
`ClientDetail.tsx`. The panel is still a `ProductPricesPanel` built on
`DeliveryPlacesPanel`'s shape — own query hook, own `editable` prop — it just
renders as a tab body rather than inside a `CollapsibleCard`.

The tab needs no permission gate of its own: the whole detail is already
Clients-scoped, and unlike Objednávky — which falls back to `info` when the user
lacks the Orders module (`ClientDetail.tsx:142`) — a price list belongs to the
module the page is already behind. Editing controls inside it take
`canEdit('clients')` as before.

One thing worth a second look during implementation rather than a decision here:
prices are money, and money elsewhere in the app is hidden from drivers via a
named capability rather than a module permission (the Fakturace card, per
`capabilityRegistry.ts`). If a role can reach a client detail but should not see
what that client pays, this tab is a capability candidate — not a change to make
speculatively, but the precedent exists if the question comes up.

### Bulk editing over the catalog

Setting a client's prices one product at a time does not survive contact with a real
catalog — the seeded demo has 22 products, production has around 230. So the Ceník tab
carries a second action, **Hromadná úprava cen**, opening a wide drawer over the
**whole catalog** (not a scope the operator has to choose first).

The drawer offers two ways to fill one column, and neither is the primary one:

- A **percentage against the ceník**, signed, so `−5` is a discount and `3` an
  increase. It fills every row at once.
- An **exact amount per row**. Walking the catalog and typing prices is a first-class
  path; the percentage is a shortcut for filling the table, not the way prices are
  expressed.

Whatever stands in the inputs is what gets saved, under one button.

**The percentage works from the ceník price, never from the client's current one.**
Running it twice therefore lands on the same number, and "95 % of ceník" stays
explainable a year later. The cost is that it can *raise* a price the client already
has — when their existing discount was deeper than the percentage being applied. That
is legitimate, but invisible when one click filled 230 rows, so the affected rows are
marked in the preview rather than left to be discovered on an invoice.

**An empty input means the client pays the ceník.** Clearing a price that exists
deletes the row on save, which is the same thing the trash button in the Ceník table
does — the two must not mean different things. Rows in that state say so before
anything is written.

For the same reason the drawer has **Vyprázdnit vše** beside the recalculate button.
Without it the tool is asymmetric: one click can give a client prices on the whole
catalog, and undoing it would mean 230 individual deletions. With it, reverting a
client to ceník prices is also one action.

A search field filters the rows. It is a view over the table, not a scope on the save:
prices typed into a row that is currently filtered out are still written.

### OrderEditor

Where a catalog row has a non-null `listPriceWithVat`, the client price renders as
primary with the list price struck through beside it, plus a marker making clear
the total is not list price. The price render sites are `OrderEditor.tsx:151`
(catalog row) and `:194` (a cart line); the totals at `:422` and `:777` already
read `priceWithVat`, so they become correct with no arithmetic change. (These were
`:439` and `:770` when this was written — the file has since grown.)

`OrderEditor.tsx` is at 997 lines, well past the ~500-line threshold at which
`app/CLAUDE.md` asks for the pure shaping logic to move to a sibling module. This
feature adds marker-rendering to it. Splitting it is **not** in this feature's
scope, but the next change to touch it should propose the split separately —
`orderCatalogModel.ts` is already the sibling it would grow into.

### Order detail

Item rows gain a unit price and line total, with the same override marker.

All new copy is Czech; identifiers and comments English.

## Staleness after a price-list import

When this was written, a catalog price only moved because someone edited a product
or ran `BulkPriceDrawer` over one brewery — deliberate acts, one at a time, by
someone who could reasonably be expected to know which clients had overrides. On
that basis a "this override may be stale" warning was pushed out of scope.

Price-list import changed the premise. `Product.PriceEffectiveFrom` records the
date the list that set a product's prices takes effect, and `PriceListImport`
records the import as a whole. A single import can now move a whole brewery's
catalog in one action — including *below* a client's override, which silently turns
a discount into a surcharge with nothing anywhere saying so. The override keeps
resolving correctly and the invoice keeps freezing correctly; the number is just
quietly wrong for the business.

The mitigation is provenance on the override itself, and it does cost a column:
`PublicEntity` inherits only `Id` and `PublicId` from `BaseEntity`, so an override
carries no timestamp of its own — this repo has no `AuditableEntity` base despite
what the pack's EF rules assume. Add `ClientProductPrice.SetOn: DateOnly`, written
server-side on every upsert. Comparing it against the product's
`PriceEffectiveFrom` answers "was this override decided before or after the price
list that currently governs this product" — the staleness question, directly, in
the list query, from two columns already loaded.

**Decided: the column lands now, the marker does not.** `SetOn` is written from the
first migration; no UI reads it yet.

The asymmetry is what decides it. A marker is addable whenever someone wants it,
against data that will by then be real. The column is not: added a year later, the
migration has nothing truthful to backfill with, so every pre-existing override
gets the migration date and the marker then lies precisely about the old overrides
it exists to catch. One is cheap to defer, the other is impossible to.

So the staleness *question* stays answerable and the staleness *UI* stays out of
scope — see #out-of-scope. When it does get built, the shape it should take is a
passive marker on the Ceník row and nothing more: no warning at import time, no
blocking an import, no recomputing overrides. An import must not rewrite a pricing
decision a human made.

## Testing

**`ClientPriceResolver` unit tests** — pure, no DbContext: ratio math, a
zero-priced product, null derived fields staying null, rounding, and
no-override passthrough.

**Endpoint tests** (Moq.EntityFrameworkCore, per the repo's existing pattern):
upsert creates then overwrites; delete reverts to catalog; 404 on an unknown
client or product; validator rejects a non-positive price.

**Snapshot test** — a loaded shipment for a client holding an override bills the
override, and repricing afterwards leaves that invoice untouched.

**Frontend** — the Ceník tab's interactions, and the override marker rendering
in the OrderEditor catalog and on order detail. Per `app/CLAUDE.md`, mock the
resource hook so it can express loading, error and no-data.

**Counter-sale prefill** — a line added from "Procházet sklad" and the same line
added from "Dříve prodané" both default to the override, an operator edit still
wins over both, the history row still displays `lastUnitPriceWithVat`, and a
walk-in sale resolves nothing. The two-segments-agree case is the one worth
asserting explicitly: it is the whole reason the decision went this way, and a
regression there would be invisible from either segment alone.

**`SetOn`** — the upsert writes it on create and refreshes it on overwrite. That is
the extent of it; there is no marker to test yet.

**The new tab** — `clientDetailTab.test.ts` covers the widened `SubTab`: the new
`?tab=` value narrows to itself, and an unknown value still falls back to `info`.

**The bulk editor** — the percentage fill is idempotent (two runs from the ceník give
the same number); a positive percentage raises; exact per-row amounts save with no
percentage involved; clearing a row deletes that price and leaves the client's others
alone; Vyprázdnit vše plus save reverts the client to ceník without touching another
client; a row priced above the client's current one is marked; a non-positive amount is
skipped rather than written; and a price typed into a row that search has filtered out
is still saved.

Two harness traps this slice will hit, both already paid for once: endpoint tests
go through `EndpointBuilder`/`Factory.Create`, which bypasses DI — a new
constructor parameter on an existing endpoint breaks every test that builds it —
and `AsQueryable()` over a mocked `DbSet` breaks `ToListAsync`, so set the mock up
with `Moq.EntityFrameworkCore`'s `ReturnsDbSet` instead.

## Out of scope

Deliberately excluded; each is addable later without reshaping the above.

- Percentage discounts **as a stored form**. A percentage is an input the bulk editor
  accepts to fill absolute prices with (#bulk-editing-over-the-catalog); what lands in
  the table is always an absolute price per product, and nothing reads a percentage
  back. "Client pays 95 % of ceník" is not a rule this feature can express.
- Validity date ranges on an override.
- Brewery-wide or product-category-wide overrides **as a stored rule**. The bulk editor
  can write a whole catalog's worth of rows in one action, but each row stands alone —
  there is no entity meaning "everything from this brewery, minus five percent", so a
  product added to a brewery later inherits nothing.
- Price-list templates shared across clients.
- **The staleness marker UI.** The `set_on` column it needs is in scope and ships
  with the first migration; nothing reads it yet. See
  #staleness-after-a-price-list-import for why the column could not wait and the
  marker could.
- Any import-side reaction to overrides: no warning while importing a price list,
  no blocking one, no recomputing overrides against it.
- Pre-filling counter-sale lines for a **walk-in** buyer (`BuyerKind` other than
  `Client`). There is no client, so there is no override to resolve.
