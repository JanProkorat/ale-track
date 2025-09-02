import {router} from "../main";
import {Client} from './Client';
import { API_BASE_URL } from './api';

import type {UserListItemDto, OrderListItemDto, ClientListItemDto, DriverListItemDto, BreweryListItemDto, VehicleListItemDto, ProductListItemDto, InventoryItemListItemDto, BreweryProductListItemDto, ProductDeliveryListItemDto} from './Client';

const baseAddress = API_BASE_URL;

export class AuthorizedClient extends Client {

    constructor(baseUrl?: string) {
        super(baseUrl ?? baseAddress, { fetch: authorizedFetch });
    }

    async fetchClients(filters: Record<string, string>) {
        const url = new URL('/ale-track/clients', baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch clients');
        }

        return await response.json() as Promise<ClientListItemDto[]>;
    }

    async fetchBreweries(filters: Record<string, string>) {
        const url = new URL('/ale-track/breweries', baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch breweries');
        }

        return await response.json() as Promise<BreweryListItemDto[]>;
    }

    async fetchDrivers(filters: Record<string, string>) {
        const url = new URL('/ale-track/drivers', baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch drivers');
        }

        return await response.json() as Promise<DriverListItemDto[]>;
    }

    async fetchVehicles(filters: Record<string, string>) {
        const url = new URL('/ale-track/vehicles', baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch drivers');
        }

        return await response.json() as Promise<VehicleListItemDto[]>;
    }

    async fetchBreweryProducts(id: string, filters: Record<string, string>) {
        const url = new URL(`/ale-track/breweries/${id}/products`, baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        return await response.json() as Promise<BreweryProductListItemDto[]>;
    }

    async fetchProductDeliveries(filters: Record<string, string>) {
        const url = new URL('/ale-track/products/deliveries', baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch product deliveries');
        }

        return await response.json() as Promise<ProductDeliveryListItemDto[]>;
    }

    async fetchInventoryItems(filters: Record<string, string>) {
        const url = new URL('/ale-track/inventory-items', baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch inventory items');
        }

        return await response.json() as Promise<InventoryItemListItemDto[]>;
    }

    async fetchUsers(filters: Record<string, string>) {
        const url = new URL('/ale-track/users', baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch inventory items');
        }

        return await response.json() as Promise<UserListItemDto[]>;
    }

    async fetchOrders(filters: Record<string, string>) {
        const url = new URL('/ale-track/orders', baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }

        return await response.json() as Promise<OrderListItemDto[]>;
    }

    async fetchProducts(filters: Record<string, string>) {
        const url = new URL(`/ale-track/products`, baseAddress);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.append(key, value);
        }

        const response = await authorizedFetch(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        return await response.json() as Promise<ProductListItemDto[]>;
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