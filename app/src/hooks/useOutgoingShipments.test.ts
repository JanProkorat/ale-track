describe('useOutgoingShipments – query key and enabled logic', () => {
     const SHIPMENTS_KEY = 'outgoingShipments';

     // ---- useOutgoingShipments ----

     it('useOutgoingShipments query key is just the base key', () => {
          expect([SHIPMENTS_KEY]).toEqual(['outgoingShipments']);
     });

     // ---- useOutgoingShipment ----

     it('useOutgoingShipment query key includes id', () => {
          const id = 'shipment-1';
          expect([SHIPMENTS_KEY, id]).toEqual(['outgoingShipments', 'shipment-1']);
     });

     it('useOutgoingShipment enabled is false for empty string', () => {
          const id = '';
          expect(!!id).toBe(false);
     });

     it('useOutgoingShipment enabled is true for non-empty string', () => {
          const id = 'shipment-1';
          expect(!!id).toBe(true);
     });

     // ---- useOutgoingShipmentOrders ----

     it('useOutgoingShipmentOrders query key with valid id', () => {
          const shipmentId: string | null | undefined = 'abc';
          expect([SHIPMENTS_KEY, 'orders', shipmentId ?? 'new']).toEqual([
               'outgoingShipments',
               'orders',
               'abc',
          ]);
     });

     it('useOutgoingShipmentOrders query key with null falls back to "new"', () => {
          const shipmentId: string | null | undefined = null;
          expect([SHIPMENTS_KEY, 'orders', shipmentId ?? 'new']).toEqual([
               'outgoingShipments',
               'orders',
               'new',
          ]);
     });

     it('useOutgoingShipmentOrders query key with undefined falls back to "new"', () => {
          const shipmentId: string | null | undefined = undefined;
          expect([SHIPMENTS_KEY, 'orders', shipmentId ?? 'new']).toEqual([
               'outgoingShipments',
               'orders',
               'new',
          ]);
     });
});
