import { screen, waitFor, userEvent, renderWithProviders } from 'src/test/test-utils';
import UnsavedChangesProvider, { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: (key: string) => key }),
}));

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function TestConsumer({ onNavigate }: { onNavigate?: () => void }) {
     const { setDirty, navigate } = useUnsavedChanges();
     return (
          <>
               <button onClick={() => setDirty(true)}>Set Dirty</button>
               <button onClick={() => setDirty(false)}>Set Clean</button>
               <button onClick={() => navigate(onNavigate ?? (() => {}))}>Navigate</button>
          </>
     );
}

function renderWithUnsaved(onNavigate?: () => void) {
     return renderWithProviders(
          <UnsavedChangesProvider>
               <TestConsumer onNavigate={onNavigate} />
          </UnsavedChangesProvider>,
     );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnsavedChangesProvider', () => {
     it('calls onProceed immediately when not dirty', async () => {
          const onProceed = vi.fn();
          const user = userEvent.setup();

          renderWithUnsaved(onProceed);

          await user.click(screen.getByText('Navigate'));

          expect(onProceed).toHaveBeenCalledTimes(1);
     });

     it('shows dialog when dirty and navigate is called', async () => {
          const user = userEvent.setup();

          renderWithUnsaved();

          await user.click(screen.getByText('Set Dirty'));
          await user.click(screen.getByText('Navigate'));

          expect(screen.getByText('unsavedChanges.title')).toBeInTheDocument();
          expect(screen.getByText('unsavedChanges.message')).toBeInTheDocument();
     });

     it('calls onProceed after clicking discard in dialog', async () => {
          const onProceed = vi.fn();
          const user = userEvent.setup();

          renderWithUnsaved(onProceed);

          await user.click(screen.getByText('Set Dirty'));
          await user.click(screen.getByText('Navigate'));
          await user.click(screen.getByText('unsavedChanges.discard'));

          expect(onProceed).toHaveBeenCalledTimes(1);
     });

     it('does NOT call onProceed after clicking cancel in dialog', async () => {
          const onProceed = vi.fn();
          const user = userEvent.setup();

          renderWithUnsaved(onProceed);

          await user.click(screen.getByText('Set Dirty'));
          await user.click(screen.getByText('Navigate'));
          await user.click(screen.getByText('common.cancel'));

          expect(onProceed).not.toHaveBeenCalled();
     });

     it('dialog disappears after cancel', async () => {
          const user = userEvent.setup();

          renderWithUnsaved();

          await user.click(screen.getByText('Set Dirty'));
          await user.click(screen.getByText('Navigate'));

          expect(screen.getByText('unsavedChanges.title')).toBeInTheDocument();

          await user.click(screen.getByText('common.cancel'));

          await waitFor(() => {
               expect(screen.queryByText('unsavedChanges.title')).not.toBeInTheDocument();
          });
     });

     it('dialog disappears after discard', async () => {
          const user = userEvent.setup();

          renderWithUnsaved();

          await user.click(screen.getByText('Set Dirty'));
          await user.click(screen.getByText('Navigate'));

          expect(screen.getByText('unsavedChanges.title')).toBeInTheDocument();

          await user.click(screen.getByText('unsavedChanges.discard'));

          await waitFor(() => {
               expect(screen.queryByText('unsavedChanges.title')).not.toBeInTheDocument();
          });
     });
});
