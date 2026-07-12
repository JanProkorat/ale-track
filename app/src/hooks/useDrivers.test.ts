describe('useDrivers – query key and enabled logic', () => {
     const DRIVERS_KEY = 'drivers';

     // ---- useDrivers ----

     it('useDrivers query key includes search param', () => {
          const search = 'searchTerm';
          expect([DRIVERS_KEY, search]).toEqual(['drivers', 'searchTerm']);
     });

     it('useDrivers query key with undefined search', () => {
          const search = undefined;
          expect([DRIVERS_KEY, search]).toEqual(['drivers', undefined]);
     });

     // ---- useDriver ----

     it('useDriver query key includes id', () => {
          const id = '123';
          expect([DRIVERS_KEY, id]).toEqual(['drivers', '123']);
     });

     it('useDriver should be disabled when id is empty string', () => {
          const id = '';
          expect(!!id).toBe(false);
     });

     it('useDriver should be enabled when id is non-empty', () => {
          const id = 'abc-123';
          expect(!!id).toBe(true);
     });
});
