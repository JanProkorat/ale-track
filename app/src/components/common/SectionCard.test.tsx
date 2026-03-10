import { screen, waitFor, userEvent, renderWithProviders } from 'src/test/test-utils';

import SectionCard from './SectionCard';

describe('SectionCard', () => {
     it('renders title', () => {
          renderWithProviders(
               <SectionCard title="Test Section">
                    <p>Content</p>
               </SectionCard>,
          );

          expect(screen.getByText('Test Section')).toBeInTheDocument();
     });

     it('shows children when expanded by default', () => {
          renderWithProviders(
               <SectionCard title="Test Section">
                    <p>Visible content</p>
               </SectionCard>,
          );

          expect(screen.getByText('Visible content')).toBeVisible();
     });

     it('hides children when defaultExpanded is false and reveals on click', async () => {
          const user = userEvent.setup();

          renderWithProviders(
               <SectionCard title="Test Section" defaultExpanded={false}>
                    <p>Hidden content</p>
               </SectionCard>,
          );

          // Content is in the DOM but not visible (MUI Collapse hides it)
          expect(screen.getByText('Hidden content')).not.toBeVisible();

          // Click the title to expand
          await user.click(screen.getByText('Test Section'));

          expect(screen.getByText('Hidden content')).toBeVisible();
     });

     it('toggles expand state when clicking title text', async () => {
          const user = userEvent.setup();

          renderWithProviders(
               <SectionCard title="Test Section">
                    <p>Toggle content</p>
               </SectionCard>,
          );

          expect(screen.getByText('Toggle content')).toBeVisible();

          // Click title to collapse
          await user.click(screen.getByText('Test Section'));

          // MUI Collapse wraps content in a container with height: 0 and overflow: hidden
          // In happy-dom, visibility checks may not work, so check the Collapse wrapper style
          await waitFor(() => {
               const collapseEl = screen.getByText('Toggle content').closest('.MuiCollapse-root');
               expect(collapseEl).toHaveClass('MuiCollapse-hidden');
          });
     });

     it('renders action node when provided', () => {
          renderWithProviders(
               <SectionCard title="Test Section" action={<button>Action</button>}>
                    <p>Content</p>
               </SectionCard>,
          );

          expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
     });
});
