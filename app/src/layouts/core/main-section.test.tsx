import { it, vi, expect, describe } from 'vitest';

import { renderWithProviders } from 'src/test/test-utils';

import { MainSection } from './main-section';

// ------------------------------------
// Mocks
// ------------------------------------
vi.mock('minimal-shared/utils', () => ({
     mergeClasses: (classes: string[]) => classes.filter(Boolean).join(' '),
}));

// ------------------------------------
// Tests
// ------------------------------------
describe('MainSection', () => {
     it('renders children', () => {
          const { getByText } = renderWithProviders(<MainSection>Main content here</MainSection>);

          expect(getByText('Main content here')).toBeInTheDocument();
     });

     it('renders as a main element', () => {
          const { container } = renderWithProviders(<MainSection>Content</MainSection>);

          const main = container.querySelector('main');
          expect(main).toBeInTheDocument();
     });

     it('has the correct id', () => {
          const { container } = renderWithProviders(<MainSection>Content</MainSection>);

          expect(container.querySelector('#main-area-wrapper')).toBeInTheDocument();
     });

     it('applies layout main class', () => {
          const { container } = renderWithProviders(<MainSection>Content</MainSection>);

          const main = container.querySelector('main');
          expect(main?.className).toContain('layout__main');
     });

     it('merges custom className', () => {
          const { container } = renderWithProviders(<MainSection className="custom-main">Content</MainSection>);

          const main = container.querySelector('main');
          expect(main?.className).toContain('custom-main');
     });
});
