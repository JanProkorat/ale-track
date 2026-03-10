import { navItems, mobileNavItems } from './navConfig';

describe('navItems', () => {
     it('has 9 items', () => {
          expect(navItems).toHaveLength(9);
     });

     it('all items have required fields (labelKey, path, icon)', () => {
          for (const item of navItems) {
               expect(item.labelKey).toBeTruthy();
               expect(item.path).toBeTruthy();
               expect(item.icon).toBeDefined();
          }
     });

     it('only the users item has adminOnly set to true', () => {
          const adminItems = navItems.filter((item) => item.adminOnly === true);
          expect(adminItems).toHaveLength(1);
          expect(adminItems[0].labelKey).toBe('nav.users');
     });

     it('all paths are unique', () => {
          const paths = navItems.map((item) => item.path);
          expect(new Set(paths).size).toBe(paths.length);
     });

     it('all labelKeys are unique', () => {
          const keys = navItems.map((item) => item.labelKey);
          expect(new Set(keys).size).toBe(keys.length);
     });

     it('dashboard path is /', () => {
          const dashboard = navItems.find((item) => item.labelKey === 'nav.dashboard');
          expect(dashboard).toBeDefined();
          expect(dashboard!.path).toBe('/');
     });
});

describe('mobileNavItems', () => {
     it('has 4 items', () => {
          expect(mobileNavItems).toHaveLength(4);
     });

     it('contains dashboard, clients, orders, and outgoing shipments', () => {
          expect(mobileNavItems[0]).toBe(navItems[0]); // dashboard
          expect(mobileNavItems[1]).toBe(navItems[1]); // clients
          expect(mobileNavItems[2]).toBe(navItems[2]); // orders
          expect(mobileNavItems[3].path).toBe('/outgoing-shipments');
     });
});
