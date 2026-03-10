import { screen, renderWithProviders } from 'src/test/test-utils';

import RequireAuth from './RequireAuth';
import RequireAdmin from './RequireAdmin';

const mockUseAuth = vi.fn();

vi.mock('src/hooks/useAuth', () => ({
     default: () => mockUseAuth(),
}));

vi.mock('react-router-dom', () => ({
     Navigate: ({ to }: { to: string }) => <div>{to}</div>,
}));

describe('RequireAuth', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('renders children when user is authenticated', () => {
          mockUseAuth.mockReturnValue({ user: { id: '1', name: 'Test User' } });

          renderWithProviders(
               <RequireAuth>
                    <div>Protected Content</div>
               </RequireAuth>,
          );

          expect(screen.getByText('Protected Content')).toBeInTheDocument();
     });

     it('redirects to /login when user is null', () => {
          mockUseAuth.mockReturnValue({ user: null });

          renderWithProviders(
               <RequireAuth>
                    <div>Protected Content</div>
               </RequireAuth>,
          );

          expect(screen.getByText('/login')).toBeInTheDocument();
          expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
     });
});

describe('RequireAdmin', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('renders children when user is admin', () => {
          mockUseAuth.mockReturnValue({ user: { id: '1', name: 'Admin' }, isAdmin: true });

          renderWithProviders(
               <RequireAdmin>
                    <div>Admin Content</div>
               </RequireAdmin>,
          );

          expect(screen.getByText('Admin Content')).toBeInTheDocument();
     });

     it('redirects to /login when user is null', () => {
          mockUseAuth.mockReturnValue({ user: null, isAdmin: false });

          renderWithProviders(
               <RequireAdmin>
                    <div>Admin Content</div>
               </RequireAdmin>,
          );

          expect(screen.getByText('/login')).toBeInTheDocument();
          expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
     });

     it('redirects to / when user is not admin', () => {
          mockUseAuth.mockReturnValue({ user: { id: '1', name: 'User' }, isAdmin: false });

          renderWithProviders(
               <RequireAdmin>
                    <div>Admin Content</div>
               </RequireAdmin>,
          );

          expect(screen.getByText('/')).toBeInTheDocument();
          expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
     });
});
