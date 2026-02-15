import { it, vi, expect, describe, beforeEach } from 'vitest';

import { screen, render, waitFor, fireEvent } from 'src/test/test-utils';

import { CollapsibleForm } from './collapsible-form';

vi.mock('../label/section-header', () => ({
    SectionHeader: ({ text, children, onClick }: { text: string; children: React.ReactNode; onClick?: () => void }) => (
        <div data-testid="section-header" onClick={onClick}>
            <span>{text}</span>
            <div data-testid="header-children">{children}</div>
        </div>
    ),
}));

describe('CollapsibleForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render title', () => {
        render(
            <CollapsibleForm title="My Form">
                <div>Form content</div>
            </CollapsibleForm>
        );

        expect(screen.getByText('My Form')).toBeInTheDocument();
    });

    it('should render children when expanded (default)', () => {
        render(
            <CollapsibleForm title="Test">
                <div>Child content</div>
            </CollapsibleForm>
        );

        expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should render header children when expanded', () => {
        render(
            <CollapsibleForm title="Test" headerChildren={<span>Header extra</span>}>
                <div>Body</div>
            </CollapsibleForm>
        );

        expect(screen.getByText('Header extra')).toBeInTheDocument();
    });

    it('should render headerChildren when expanded (default)', () => {
        render(
            <CollapsibleForm title="Test" headerChildren={<span>Extra</span>}>
                <div>Content</div>
            </CollapsibleForm>
        );

        expect(screen.getByText('Extra')).toBeInTheDocument();
    });

    it('should hide headerChildren when collapsed', async () => {
        render(
            <CollapsibleForm title="Test" headerChildren={<span data-testid="hdr-extra">Extra</span>}>
                <div>Content</div>
            </CollapsibleForm>
        );

        expect(screen.getByTestId('hdr-extra')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('section-header'));

        await waitFor(() => {
            expect(screen.queryByTestId('hdr-extra')).not.toBeInTheDocument();
        });
    });

    it('should toggle back to expanded on second click', async () => {
        render(
            <CollapsibleForm title="Test" headerChildren={<span data-testid="hdr-toggle">Toggle</span>}>
                <div>Content</div>
            </CollapsibleForm>
        );

        const header = screen.getByTestId('section-header');

        // Collapse
        fireEvent.click(header);
        await waitFor(() => {
            expect(screen.queryByTestId('hdr-toggle')).not.toBeInTheDocument();
        });

        // Expand again
        fireEvent.click(header);
        await waitFor(() => {
            expect(screen.getByTestId('hdr-toggle')).toBeInTheDocument();
        });
    });
});
