import { router } from '../main';
import { Client } from './Client';
import { API_BASE_URL } from './api';

import type {
     UserListItemDto,
     OrderListItemDto,
     ClientListItemDto,
     DriverListItemDto,
     BreweryListItemDto,
     VehicleListItemDto,
     ProductListItemDto,
     ReminderSectionDto,
     ReminderListItemDto,
     ClientOrderReminderDto,
     InventoryItemListItemDto,
     GroupedProductHistoryDto,
     OutgoingShipmentOrderDto,
     BreweryProductListItemDto,
     ProductDeliveryListItemDto,
     OutgoingShipmentListItemDto,
} from './Client';

const baseAddress = API_BASE_URL;

export class AuthorizedClient extends Client {
     constructor(baseUrl?: string) {
          super(baseUrl ?? baseAddress, { fetch: authorizedFetch });
     }

     private async fetchList<T>(path: string, filters: Record<string, string> = {}): Promise<T> {
          const url = new URL(path, baseAddress);
          Object.entries(filters).forEach(([k, v]) => url.searchParams.append(k, v));
          const response = await authorizedFetch(url.toString(), {
               method: 'GET',
               headers: { Accept: 'application/json' },
          });
          if (!response.ok) throw new Error(`Failed to fetch ${path}`);
          return response.json() as Promise<T>;
     }

     fetchClients(filters: Record<string, string>) {
          return this.fetchList<ClientListItemDto[]>('/ale-track/clients', filters);
     }

     fetchBreweries(filters: Record<string, string>) {
          return this.fetchList<BreweryListItemDto[]>('/ale-track/breweries', filters);
     }

     fetchDrivers(filters: Record<string, string>) {
          return this.fetchList<DriverListItemDto[]>('/ale-track/drivers', filters);
     }

     fetchVehicles(filters: Record<string, string>) {
          return this.fetchList<VehicleListItemDto[]>('/ale-track/vehicles', filters);
     }

     fetchBreweryProducts(id: string, filters: Record<string, string>) {
          return this.fetchList<BreweryProductListItemDto[]>(`/ale-track/breweries/${id}/products`, filters);
     }

     fetchProductDeliveries(filters: Record<string, string>) {
          return this.fetchList<ProductDeliveryListItemDto[]>('/ale-track/products/deliveries', filters);
     }

     fetchInventoryItems(filters: Record<string, string>) {
          return this.fetchList<InventoryItemListItemDto[]>('/ale-track/inventory-items', filters);
     }

     fetchUsers(filters: Record<string, string>) {
          return this.fetchList<UserListItemDto[]>('/ale-track/users', filters);
     }

     fetchOrders(filters: Record<string, string>) {
          return this.fetchList<OrderListItemDto[]>('/ale-track/orders', filters);
     }

     fetchProducts(filters: Record<string, string>) {
          return this.fetchList<ProductListItemDto[]>('/ale-track/products', filters);
     }

     fetchProductsWithClientHistory(clientId: string) {
          return this.fetchList<GroupedProductHistoryDto>(`/ale-track/products/client/${clientId}/history`);
     }

     fetchRemindersForBrewery(breweryId: string, filters: Record<string, string>) {
          return this.fetchList<ReminderListItemDto[]>(`/ale-track/breweries/${breweryId}/reminders`, filters);
     }

     fetchRemindersForClient(clientId: string, filters: Record<string, string>) {
          return this.fetchList<ReminderListItemDto[]>(`/ale-track/clients/${clientId}/reminders`, filters);
     }

     fetchRemindersOverview() {
          return this.fetchList<ReminderSectionDto[]>('/ale-track/reminders');
     }

     fetchOrderItemsRemindersOverview() {
          return this.fetchList<ClientOrderReminderDto[]>('/ale-track/order-items/reminders');
     }

     fetchOutgoingShipments(filters: Record<string, string> = {}) {
          return this.fetchList<OutgoingShipmentListItemDto[]>('/ale-track/outgoing-shipments', filters);
     }

     async fetOrdersForOutgoingShipments(outgoingShipmentId: string | null, filters: Record<string, string>) {
          const url = new URL(`/ale-track/outgoing-shipments/orders`, baseAddress);

          if (outgoingShipmentId) {
               url.searchParams.append('OutgoingShipmentId', outgoingShipmentId);
          }

          Object.entries(filters).forEach(([k, v]) => url.searchParams.append(k, v));

          const response = await authorizedFetch(url.toString(), {
               method: 'GET',
               headers: { Accept: 'application/json' },
          });

          if (!response.ok) throw new Error('Failed to fetch orders for outgoing shipment');
          return response.json() as Promise<OutgoingShipmentOrderDto[]>;
     }
}

const authorizedFetch: typeof fetch = async (input, init = {}) => {
     const headers = new Headers(init.headers);
     const token = localStorage.getItem('authToken');
     if (token) {
          headers.set('Authorization', `Bearer ${token}`);
     }

     const response = await fetch(input, { ...init, headers });

     if (response.status === 401) {
          await router.navigate('/sign-in');
          return Promise.reject(new Error('Unauthorized'));
     }

     return response;
};
