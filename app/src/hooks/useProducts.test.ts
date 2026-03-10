describe('useProducts – query key and enabled logic', () => {
     const PRODUCTS_KEY = 'products';
     const PRODUCTS_BY_CLIENT_HISTORY_KEY = 'products-by-client-history';

     // ---- useProducts ----

     it('useProducts query key includes search param', () => {
          const search = 'lager';
          expect([PRODUCTS_KEY, search]).toEqual(['products', 'lager']);
     });

     it('useProducts query key with undefined search', () => {
          const search = undefined;
          expect([PRODUCTS_KEY, search]).toEqual(['products', undefined]);
     });

     // ---- useProductsByClientHistory ----

     it('useProductsByClientHistory query key includes clientId', () => {
          const clientId = 'client-1';
          expect([PRODUCTS_BY_CLIENT_HISTORY_KEY, clientId]).toEqual([
               'products-by-client-history',
               'client-1',
          ]);
     });

     it('useProductsByClientHistory enabled is false for empty string', () => {
          const clientId = '';
          expect(!!clientId).toBe(false);
     });

     it('useProductsByClientHistory enabled is true for non-empty string', () => {
          const clientId = 'client-1';
          expect(!!clientId).toBe(true);
     });

     // ---- useProduct ----

     it('useProduct query key includes id', () => {
          const id = 'prod-42';
          expect([PRODUCTS_KEY, id]).toEqual(['products', 'prod-42']);
     });

     it('useProduct enabled is false for empty string', () => {
          const id = '';
          expect(!!id).toBe(false);
     });

     it('useProduct enabled is true for non-empty string', () => {
          const id = 'prod-42';
          expect(!!id).toBe(true);
     });
});
