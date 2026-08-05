import { ShipmentStartPointKind } from 'src/generated/api-client';
import { startPointKindName } from 'src/lib/labels';

/** A start point value as carried by the editor's draft: enough to identify
 * which entry from `useShipmentStartPoints()` was chosen, without the rest of
 * that entry's (server-owned) display fields. */
export interface StartPointValue {
  kind: ShipmentStartPointKind;
  breweryId?: string;
}

/** Stable <Select> value for a start point — the company has no id of its own,
 * so it is keyed by its kind while a brewery is keyed by its id. Compares
 * through `startPointKindName` rather than `=== ShipmentStartPointKind.Company`
 * — the backend serializes enums as JSON strings while the generated TS enum
 * is numeric, so a raw `===` against the numeric member never matches live
 * data (see `src/lib/labels.ts`). Pulled into its own module (rather than
 * living alongside `StartPointPicker`) so that component file only exports
 * the component itself. */
export function optionKey(point: { kind?: ShipmentStartPointKind | string; breweryId?: string }): string {
  return startPointKindName(point.kind) === 'Company' ? 'company' : `brewery:${point.breweryId ?? ''}`;
}
