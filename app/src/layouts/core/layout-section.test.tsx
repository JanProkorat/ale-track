import { it, vi, expect, describe } from 'vitest';

import { renderWithProviders } from 'src/test/test-utils';

import { LayoutSection } from './layout-section';

// ------------------------------------
// Mocks
// ------------------------------------
vi.mock('minimal-shared/utils', () => ({
     mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('./css-vars', () => ({
     layoutSectionVars: () => ({}),
}));

// ------------------------------------
// Tests
// ------------------------------------
describe('LayoutSection', () => {
     it('renders children', () => {
          const { getByText } = renderWithProviders(<LayoutSection>Page content</LayoutSection>);

          expect(getByText('Page content')).toBeInTheDocument();
     });

     it('has the root layout id', () => {
          const { container } = renderWithProviders(<LayoutSection>Content</LayoutSection>);

          expect(container.querySelector('#root__layout')).toBeInTheDocument();
     });

     it('applies layout root class', () => {
          const { container } = renderWithProviders(<LayoutSection>Content</LayoutSection>);

          const root = container.querySelector('#root__layout');
          expect(root?.className).toContain('layout__root');
     });

     it('renders header section when provided', () => {
          const { getByText } = renderWithProviders(
               <LayoutSection headerSection={<div>Header</div>}>Content</LayoutSection>
          );

          expect(getByText('Header')).toBeInTheDocument();
     });

     it('renders footer section when provided', () => {
          const { getByText } = renderWithProviders(
               <LayoutSection footerSection={<div>Footer</div>}>Content</LayoutSection>
          );

          expect(getByText('Footer')).toBeInTheDocument();
     });

     it('renders sidebar section when provided', () => {
          const { getByText } = renderWithProviders(
               <LayoutSection sidebarSection={<nav>Sidebar</nav>}>Content</LayoutSection>
          );

          expect(getByText('Sidebar')).toBeInTheDocument();
     });

     it('wraps content in sidebar container when sidebar is provided', () => {
          const { container } = renderWithProviders(
               <LayoutSection sidebarSection={<nav>Sidebar</nav>} headerSection={<div>Header</div>}>
                    Content
               </LayoutSection>
          );

          const sidebarContainer = container.querySelector('[class*="layout__sidebar__container"]');
          expect(sidebarContainer).toBeInTheDocument();
     });

     it('does not render sidebar container when no sidebar', () => {
          const { container } = renderWithProviders(<LayoutSection>Content</LayoutSection>);

          const sidebarContainer = container.querySelector('[class*="layout__sidebar__container"]');
          expect(sidebarContainer).not.toBeInTheDocument();
     });

     it('merges custom className', () => {
          const { container } = renderWithProviders(<LayoutSection className="custom-layout">Content</LayoutSection>);

          const root = container.querySelector('#root__layout');
          expect(root?.className).toContain('custom-layout');
     });
});
