import { describe, expect, it } from 'vitest';
import { GroupedProductHistoryDto } from 'src/generated/api-client';
import { catalogByProductId } from './clientPrices';

function history(json: unknown): GroupedProductHistoryDto {
  return GroupedProductHistoryDto.fromJS(json);
}

describe('catalogByProductId', () => {
  it('reads a product out of the brewery tree, four levels down', () => {
    const map = catalogByProductId(history({
      recent: [],
      breweries: [{
        breweryId: 'b-1',
        breweryName: 'Primátor',
        kinds: [{
          kind: 1,
          packageSizes: [{ size: 0.5, items: [{ id: 'p-1', name: 'Prim. limo Hrozno', priceWithVat: 351 }] }],
        }],
      }],
    }));

    expect(map.get('p-1')?.priceWithVat).toBe(351);
  });

  it('reads one out of the recent list', () => {
    const map = catalogByProductId(history({
      recent: [{ id: 'p-2', name: 'Svijany 450', priceWithVat: 2370, listPriceWithVat: 2500 }],
      breweries: [],
    }));

    expect(map.get('p-2')?.priceWithVat).toBe(2370);
    expect(map.get('p-2')?.listPriceWithVat).toBe(2500);
  });

  // The client's price is what the endpoint resolved; whichever half of the response it arrived
  // in, the row must not fall back to a second, different figure.
  it('keeps one price for a product that appears in both halves', () => {
    const map = catalogByProductId(history({
      recent: [{ id: 'p-3', name: 'Ležák 12', priceWithVat: 900 }],
      breweries: [{
        breweryId: 'b-2',
        kinds: [{ kind: 0, packageSizes: [{ size: 50, items: [{ id: 'p-3', name: 'Ležák 12', priceWithVat: 1200 }] }] }],
      }],
    }));

    expect(map.size).toBe(1);
    expect(map.get('p-3')?.priceWithVat).toBe(900);
  });

  // The hook is disabled until a client is picked, so the order detail asks before there is
  // anything to ask about on every first render.
  it('is empty rather than throwing when the history has not arrived', () => {
    expect(catalogByProductId(undefined).size).toBe(0);
    expect(catalogByProductId(history({})).size).toBe(0);
  });

  it('skips an item with no id, which nothing could look up anyway', () => {
    const map = catalogByProductId(history({
      recent: [{ name: 'Bez id', priceWithVat: 100 }],
      breweries: [],
    }));

    expect(map.size).toBe(0);
  });
});
