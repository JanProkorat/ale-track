import { useQuery } from '@tanstack/react-query';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

const MODULE_COUNTS_KEY = 'moduleCounts';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useModuleCounts() {
     const query = useQuery({
          queryKey: [MODULE_COUNTS_KEY],
          queryFn: ({ signal }) => apiClient.getNumberOfRecordsInEachModuleEndpoint(signal),
          staleTime: 2 * 60 * 1000, // 2 minutes
     });

     const data = query.data;

     // Map DTO fields to badgeKey values used in navConfig
     const counts: Record<string, number> = data
          ? {
                 clients: data.clientsCount ?? 0,
                 orders: data.ordersCount ?? 0,
                 breweries: data.breweriesCount ?? 0,
                 drivers: data.driversCount ?? 0,
                 vehicles: data.vehiclesCount ?? 0,
                 outgoingShipments: data.outgoingShipmentsCount ?? 0,
                 productDeliveries: data.productDeliveriesCount ?? 0,
                 inventoryItems: data.inventoryItemsCount ?? 0,
                 users: data.usersCount ?? 0,
            }
          : {};

     return { counts, ...query };
}
