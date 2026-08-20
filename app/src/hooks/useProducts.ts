// Products module hooks — read-only list, used by the Sklad (inventory)
// product picker to resolve a brewery product into a new inventory item.

import { useQuery } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';

export function useProducts(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.products.list(params),
    queryFn: ({ signal }) => ds.getProductsListEndpoint(params, signal),
  });
}
