import type { UserRoleType } from 'src/api/Client';

import { it, vi, expect, describe } from 'vitest';

import { NumberOfRecordsInEachModuleDto } from 'src/api/Client';

import { getNavData } from './nav-config-dashboard';

import type { NavDataProps } from './nav-config-dashboard';

// -------------------------------------------------------------------

vi.mock('src/components/label', () => ({
    Label: ({ children }: any) => <span data-testid="label">{children}</span>,
}));

vi.mock('src/components/svg-color', () => ({
    SvgColor: ({ src }: any) => <span data-testid="svg-color">{src}</span>,
}));

vi.mock('@mui/icons-material/FactoryTwoTone', () => ({
    default: () => <span />,
}));
vi.mock('@mui/icons-material/ArchiveTwoTone', () => ({
    default: () => <span />,
}));
vi.mock('@mui/icons-material/UploadFileTwoTone', () => ({
    default: () => <span />,
}));
vi.mock('@mui/icons-material/ShoppingCartTwoTone', () => ({
    default: () => <span />,
}));
vi.mock('@mui/icons-material/LocalShippingTwoTone', () => ({
    default: () => <span />,
}));
vi.mock('@mui/icons-material/AccountCircleTwoTone', () => ({
    default: () => <span />,
}));

describe('getNavData', () => {
    // The filter uses UserRoleType[userRole] reverse lookup, so userRole comes as a string from JWT
    const defaultProps: NavDataProps = {
        numberOfRecordsInEachModule: undefined,
        userRole: 'Admin' as unknown as UserRoleType,
    };

    it('returns all items for Admin role', () => {
        const items = getNavData(defaultProps);
        // Dashboard, clients, orders, breweries, drivers, vehicles, outgoing-shipments, product-deliveries, users
        expect(items.length).toBe(9);
    });

    it('excludes users item for User role', () => {
        const items = getNavData({ ...defaultProps, userRole: 'User' as unknown as UserRoleType });
        const userItem = items.find((item) => item.path === '/users');
        expect(userItem).toBeUndefined();
    });

    it('includes dashboard for User role', () => {
        const items = getNavData({ ...defaultProps, userRole: 'User' as unknown as UserRoleType });
        const dashboardItem = items.find((item) => item.path === '/dashboard');
        expect(dashboardItem).toBeDefined();
    });

    it('returns expected paths', () => {
        const items = getNavData(defaultProps);
        const paths = items.map((item) => item.path);
        expect(paths).toContain('/dashboard');
        expect(paths).toContain('/clients');
        expect(paths).toContain('/orders');
        expect(paths).toContain('/breweries');
        expect(paths).toContain('/drivers');
        expect(paths).toContain('/vehicles');
        expect(paths).toContain('/outgoing-shipments');
        expect(paths).toContain('/product-deliveries');
        expect(paths).toContain('/users');
    });

    it('each item has a title, path, icon, and allowedRoles', () => {
        const items = getNavData(defaultProps);
        items.forEach((item) => {
            expect(item.title).toBeDefined();
            expect(item.path).toBeDefined();
            expect(item.icon).toBeDefined();
            expect(item.allowedRoles).toBeDefined();
        });
    });

    it('does not include info labels when counts are undefined', () => {
        const items = getNavData(defaultProps);
        items.forEach((item) => {
            expect(item.info).toBeUndefined();
        });
    });

    it('includes info labels when counts are provided', () => {
        const counts = new NumberOfRecordsInEachModuleDto({
            clientsCount: 5,
            ordersCount: 10,
            breweriesCount: 3,
            driversCount: 7,
            vehiclesCount: 2,
            outgoingShipmentsCount: 4,
            productDeliveriesCount: 6,
            usersCount: 8,
        });
        const items = getNavData({ ...defaultProps, numberOfRecordsInEachModule: counts });
        const itemsWithInfo = items.filter((item) => item.info !== undefined);
        // All items except Dashboard have info when counts are provided
        expect(itemsWithInfo.length).toBe(8);
    });

    it('returns empty array for undefined role', () => {
        const items = getNavData({ ...defaultProps, userRole: undefined });
        expect(items).toEqual([]);
    });
});
