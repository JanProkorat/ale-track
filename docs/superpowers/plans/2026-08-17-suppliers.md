# Implementation plan — Dodavatelé (suppliers registry)

**Spec:** `docs/superpowers/specs/2026-08-17-suppliers-design.md`
**Branch:** `feature/suppliers` (own worktree)

Backend and frontend are one commit per task where a task spans both, because
`api-client.ts` is generated: a DTO change and its consumption cannot be split
without leaving the app uncompilable in between.

## Phase 1 — persistence

1. **Enums.** `SupplierChargeKind`; append `Suppliers` to `ModuleType`.
2. **Entities.** `Supplier`, `SupplierContact`, `SupplierOpeningHours`,
   `SupplierGood`, `SupplierGoodPrice`, `SupplierNote`.
3. **DbContext + configurations.** Six `DbSet`s; `SupplierConfiguration` (owned
   addresses, `!IsDeleted` filter), child configs filtering through the
   relationship, unique `(supplier_good_id, kind)` index, FK indexes.
4. **Migration** `AddSuppliers`. Review the generated SQL before applying.

## Phase 2 — read endpoints

5. **GET `suppliers`** → `SupplierListItemDto` (id, name, businessName,
   officialAddress, contacts, goodsCount, openingHours). One call, no N+1.
6. **GET `suppliers/{id}`** → `SupplierDto` (+ contactAddress, note, goods with
   ordered prices).
7. **Counts.** `SuppliersCount` on `NumberOfRecordsInEachModuleDto`.

## Phase 3 — write endpoints

8. **POST / PUT / DELETE `suppliers`** with validators (name, addresses,
   contacts). Delete is a soft delete.
9. **PUT `suppliers/{id}/opening-hours`** — whole-week replace. Validator
   enforces `From < To` and no overlap within a weekday.
10. **POST / PUT / DELETE `suppliers/{id}/goods`** — prices arrive with the good;
    validator enforces ≥1 price and unique charge kinds.
11. **Notes** — GET / POST / DELETE `suppliers/{id}/notes`, mirroring the
    client-note endpoints.

## Phase 4 — backend tests

12. Create/update/delete supplier; hours replace incl. both rejections; goods
    create/update/delete incl. duplicate-kind rejection; list/detail projections.
    Then the full suite — not a filtered slice.

## Phase 5 — client regeneration

13. Run the backend on :8080, `yarn generate-api`, confirm the four DTO families
    and ten endpoints landed, `yarn build` clean.

## Phase 6 — frontend

14. **Wiring.** `MODULE_KEYS`, `PATHS`, `NAV_GROUPS`, routes, `KEY_TO_MODULE`,
    users permission matrix, `qk.suppliers`, sidebar count.
15. **Pure modules first (TDD).** `supplierHours.ts` + test (the prototype's 30
    assertions), `supplierGoods.ts` + test.
16. **`useSuppliers.ts`** — list/detail/create/update/delete + hours, goods, notes.
17. **List screen** — `SuppliersPage.tsx`, search with subscript-digit folding,
    the "Dnes" column, empty/loading/error via `QueryBoundary`.
18. **Detail** — `SupplierDetail.tsx` + `OpeningHoursPanel`, `GoodsPricesPanel`,
    notes panel; tab state in the URL (`?tab=`).
19. **Drawers** — `SupplierFormDrawer`, `OpeningHoursDrawer`, `SupplierGoodDrawer`.
20. **Component tests** — page (loading/error/empty), both editing drawers.

## Phase 7 — verification

21. `dotnet-verify` (full backend suite) and `react-verify` (build + lint +
    tests). Both green before the branch is offered for merge.
