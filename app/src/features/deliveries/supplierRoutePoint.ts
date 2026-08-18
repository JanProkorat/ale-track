import type { SupplierDto } from 'src/generated/api-client';

/**
 * Where on the map a supplier sits: the branch actually visited when it has been geocoded, the
 * registered seat otherwise.
 *
 * Both coordinates come from whichever address the latitude test picks, never one from each — a
 * half-geocoded branch would otherwise put the pin in a field somewhere between the two.
 *
 * The backend applies the same rule when it serves a saved delivery's stops, because the suppliers
 * register is behind its own permission and a planner without it still needs a complete route. This
 * copy is for the editor, which is pricing and plotting a supplier the user has only just picked
 * and which is therefore not on any saved stop yet.
 */
export function supplierRoutePoint(supplier: SupplierDto | undefined): { lat?: number; lng?: number } {
  const contact = supplier?.contactAddress;
  const address = contact?.latitude != null ? contact : supplier?.officialAddress;
  return { lat: address?.latitude ?? undefined, lng: address?.longitude ?? undefined };
}
