// Demo-mode implementation of the generated API client. Only the endpoints the
// UI actually calls are implemented; anything else throws a clear error so a
// missing demo slice is obvious during development rather than silently empty.
//
// Typed as the generated `IClient` so every implemented method's signature is
// checked against the real client — demo and live can never drift apart.

import {
  type IClient,
  VehicleListItemDto,
  VehicleDto,
  type CreateVehicleDto,
  type UpdateVehicleDto,
} from 'src/generated/api-client';
import { db, mockId, mockDelay, MockNotFoundError } from './db';

/** Case-insensitive substring match for demo-side list search. */
function matches(haystack: string | undefined, needle: string | undefined): boolean {
  if (!needle) return true;
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

const impl: Partial<IClient> = {
  // ---- Vehicles -----------------------------------------------------------
  getVehiclesListEndpoint(parameters: { [key: string]: string }) {
    const search = parameters?.['search'] ?? parameters?.['Search'];
    const rows = db.vehicles
      .filter((v) => matches(v.name, search))
      .map((v) => new VehicleListItemDto({ id: v.id, name: v.name, maxWeight: v.maxWeight }));
    return mockDelay(rows);
  },
  getVehicleDetailEndpoint(id: string) {
    const v = db.vehicles.find((x) => x.id === id);
    if (!v) return Promise.reject(new MockNotFoundError('Vůz'));
    return mockDelay(new VehicleDto({ ...v }));
  },
  createVehicleEndpoint(data: CreateVehicleDto) {
    const id = mockId('veh');
    db.vehicles.unshift({ id, name: data.name, maxWeight: data.maxWeight });
    return mockDelay(id);
  },
  updateVehicleEndpoint(id: string, data: UpdateVehicleDto) {
    const v = db.vehicles.find((x) => x.id === id);
    if (!v) return Promise.reject(new MockNotFoundError('Vůz'));
    v.name = data.name;
    v.maxWeight = data.maxWeight;
    return mockDelay(id);
  },
  deleteVehicleEndpoint(id: string) {
    const i = db.vehicles.findIndex((x) => x.id === id);
    if (i >= 0) db.vehicles.splice(i, 1);
    return mockDelay(id);
  },
};

/** Proxy that serves implemented demo endpoints and throws a clear error for
 * any endpoint not yet backed by a demo slice. */
export const mockApi: IClient = new Proxy(impl as IClient, {
  get(target, prop: string | symbol) {
    const fn = (target as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof fn === 'function') return fn.bind(target);
    return () =>
      Promise.reject(
        new Error(`Demo režim: endpoint "${String(prop)}" zatím není k dispozici.`)
      );
  },
});
