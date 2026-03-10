describe('useModuleCounts data mapping logic', () => {
     function mapCounts(data: Record<string, number | null | undefined> | null | undefined) {
          const counts: Record<string, number> = data
               ? {
                      clients: data.clientsCount ?? 0,
                      orders: data.ordersCount ?? 0,
                      breweries: data.breweriesCount ?? 0,
                      drivers: data.driversCount ?? 0,
                      vehicles: data.vehiclesCount ?? 0,
                      outgoingShipments: data.outgoingShipmentsCount ?? 0,
                      productDeliveries: data.productDeliveriesCount ?? 0,
                      inventory: data.inventoryItemsCount ?? 0,
                      users: data.usersCount ?? 0,
                 }
               : {};
          return counts;
     }

     it('maps all DTO fields to correct keys', () => {
          const data = {
               clientsCount: 10,
               ordersCount: 20,
               breweriesCount: 3,
               driversCount: 5,
               vehiclesCount: 8,
               outgoingShipmentsCount: 15,
               productDeliveriesCount: 12,
               inventoryItemsCount: 42,
               usersCount: 7,
          };

          const result = mapCounts(data);

          expect(result).toEqual({
               clients: 10,
               orders: 20,
               breweries: 3,
               drivers: 5,
               vehicles: 8,
               outgoingShipments: 15,
               productDeliveries: 12,
               inventory: 42,
               users: 7,
          });
     });

     it('returns empty object when data is null', () => {
          expect(mapCounts(null)).toEqual({});
     });

     it('returns empty object when data is undefined', () => {
          expect(mapCounts(undefined)).toEqual({});
     });

     it('defaults to 0 for null count fields', () => {
          const data = {
               clientsCount: null,
               ordersCount: null,
               breweriesCount: null,
               driversCount: null,
               vehiclesCount: null,
               outgoingShipmentsCount: null,
               productDeliveriesCount: null,
               inventoryItemsCount: null,
               usersCount: null,
          };

          const result = mapCounts(data);

          expect(result).toEqual({
               clients: 0,
               orders: 0,
               breweries: 0,
               drivers: 0,
               vehicles: 0,
               outgoingShipments: 0,
               productDeliveries: 0,
               inventory: 0,
               users: 0,
          });
     });

     it('defaults to 0 for undefined count fields', () => {
          const data = {
               clientsCount: undefined,
               ordersCount: undefined,
               breweriesCount: undefined,
               driversCount: undefined,
               vehiclesCount: undefined,
               outgoingShipmentsCount: undefined,
               productDeliveriesCount: undefined,
               inventoryItemsCount: undefined,
               usersCount: undefined,
          };

          const result = mapCounts(data);

          expect(result).toEqual({
               clients: 0,
               orders: 0,
               breweries: 0,
               drivers: 0,
               vehicles: 0,
               outgoingShipments: 0,
               productDeliveries: 0,
               inventory: 0,
               users: 0,
          });
     });

     it('preserves actual count values and defaults missing ones', () => {
          const data = {
               clientsCount: 5,
               ordersCount: undefined,
               breweriesCount: 0,
               driversCount: null,
               vehiclesCount: 100,
               outgoingShipmentsCount: undefined,
               productDeliveriesCount: 3,
               inventoryItemsCount: null,
               usersCount: 1,
          };

          const result = mapCounts(data);

          expect(result).toEqual({
               clients: 5,
               orders: 0,
               breweries: 0,
               drivers: 0,
               vehicles: 100,
               outgoingShipments: 0,
               productDeliveries: 3,
               inventory: 0,
               users: 1,
          });
     });
});
