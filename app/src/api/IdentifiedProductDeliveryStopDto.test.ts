import { it, vi, expect, describe } from 'vitest';

import { IdentifiedProductDeliveryItemDto, IdentifiedProductDeliveryStopDto } from './IdentifiedProductDeliveryStopDto';

vi.mock('uuid', () => ({
     v4: () => 'mock-uuid',
}));

describe('IdentifiedProductDeliveryItemDto', () => {
     it('should generate id when not provided', () => {
          const item = new IdentifiedProductDeliveryItemDto({
               productId: 'p1',
               quantity: 10,
          });

          expect(item.id).toBe('mock-uuid');
          expect(item.productId).toBe('p1');
          expect(item.quantity).toBe(10);
     });

     it('should use provided id', () => {
          const item = new IdentifiedProductDeliveryItemDto({
               id: 'custom-id',
               productId: 'p1',
               quantity: 5,
          });

          expect(item.id).toBe('custom-id');
     });

     it('should serialize to JSON with id', () => {
          const item = new IdentifiedProductDeliveryItemDto({
               id: 'item-1',
               productId: 'p1',
               quantity: 3,
               note: 'test note',
          });

          const json = item.toJSON();

          expect(json.id).toBe('item-1');
          expect(json.productId).toBe('p1');
          expect(json.quantity).toBe(3);
          expect(json.note).toBe('test note');
     });

     it('should deserialize from JS object', () => {
          const item = IdentifiedProductDeliveryItemDto.fromJS({
               id: 'item-2',
               productId: 'p2',
               quantity: 7,
          });

          expect(item.id).toBe('item-2');
          expect(item.productId).toBe('p2');
          expect(item.quantity).toBe(7);
     });

     it('should generate id in fromJS when id not provided', () => {
          const item = IdentifiedProductDeliveryItemDto.fromJS({
               productId: 'p3',
               quantity: 1,
          });

          expect(item.id).toBe('mock-uuid');
     });
});

describe('IdentifiedProductDeliveryStopDto', () => {
     it('should generate id when not provided', () => {
          const stop = new IdentifiedProductDeliveryStopDto({
               breweryId: 'b1',
               note: 'delivery note',
          });

          expect(stop.id).toBe('mock-uuid');
          expect(stop.breweryId).toBe('b1');
          expect(stop.note).toBe('delivery note');
     });

     it('should use provided id', () => {
          const stop = new IdentifiedProductDeliveryStopDto({
               id: 'stop-1',
               breweryId: 'b1',
          });

          expect(stop.id).toBe('stop-1');
     });

     it('should create identified products from constructor data', () => {
          const stop = new IdentifiedProductDeliveryStopDto({
               breweryId: 'b1',
               products: [
                    new IdentifiedProductDeliveryItemDto({ productId: 'p1', quantity: 10 }),
                    new IdentifiedProductDeliveryItemDto({ productId: 'p2', quantity: 20 }),
               ],
          });

          expect(stop.products).toHaveLength(2);
          expect(stop.products![0]).toBeInstanceOf(IdentifiedProductDeliveryItemDto);
          expect(stop.products![0].productId).toBe('p1');
          expect(stop.products![1].quantity).toBe(20);
     });

     it('should serialize to JSON with id and products', () => {
          const stop = new IdentifiedProductDeliveryStopDto({
               id: 'stop-2',
               breweryId: 'b1',
               note: 'note',
               products: [new IdentifiedProductDeliveryItemDto({ productId: 'p1', quantity: 5 })],
          });

          const json = stop.toJSON();

          expect(json.id).toBe('stop-2');
          expect(json.breweryId).toBe('b1');
          expect(json.note).toBe('note');
          expect(json.products).toHaveLength(1);
          expect(json.products[0].productId).toBe('p1');
     });

     it('should deserialize from JS object', () => {
          const stop = IdentifiedProductDeliveryStopDto.fromJS({
               id: 'stop-3',
               breweryId: 'b2',
               products: [{ id: 'item-x', productId: 'p3', quantity: 15 }],
          });

          expect(stop.id).toBe('stop-3');
          expect(stop.breweryId).toBe('b2');
          expect(stop.products).toHaveLength(1);
          expect(stop.products![0].id).toBe('item-x');
     });

     it('should handle empty products array', () => {
          const stop = new IdentifiedProductDeliveryStopDto({
               breweryId: 'b1',
          });

          expect(stop.products).toBeUndefined();
     });

     it('should generate id in fromJS when id not provided', () => {
          const stop = IdentifiedProductDeliveryStopDto.fromJS({
               breweryId: 'b1',
          });

          expect(stop.id).toBe('mock-uuid');
     });
});
