import { it, vi, expect, describe, beforeEach } from 'vitest';

import { createTheme } from '@mui/material/styles';

import { screen, waitFor, render as baseRender } from 'src/test/test-utils';

import { ClientSelect } from './client-select';
import { ClientListItemDto } from '../../../api/Client';

// Create a theme with CSS variables enabled (matches app config)
const testTheme = createTheme({ cssVariables: { cssVarPrefix: '' } });
const render = (ui: React.ReactElement) => baseRender(ui, { theme: testTheme });

// Stable t reference
const mockT = (key: string) => key;

// Mock react-i18next (partial)
vi.mock('react-i18next', async (importOriginal) => {
     const actual = (await importOriginal()) as Record<string, unknown>;
     return {
          ...actual,
          useTranslation: () => ({ t: mockT }),
     };
});

// Mock useApiCall
const mockExecuteApiCallWithDefault = vi.fn();
vi.mock('../../../hooks/use-api-call', () => ({
     useApiCall: () => ({
          executeApiCallWithDefault: mockExecuteApiCallWithDefault,
     }),
}));

// Mock AuthorizedClient
vi.mock('../../../api/AuthorizedClient', () => ({
     AuthorizedClient: class {
          fetchClients = vi.fn();
     },
}));

const mockOnSelect = vi.fn();

const mockClients = [
     new ClientListItemDto({ id: 'c1', name: 'Brewery Pub' }),
     new ClientListItemDto({ id: 'c2', name: 'Beer Garden' }),
     new ClientListItemDto({ id: 'c3', name: 'Tap Room' }),
];

describe('ClientSelect', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mockExecuteApiCallWithDefault.mockResolvedValue(mockClients);
     });

     it('should render the client select label', async () => {
          render(<ClientSelect selectedClientId={null} shouldValidate={false} onSelect={mockOnSelect} />);

          await waitFor(() => {
               expect(mockExecuteApiCallWithDefault).toHaveBeenCalled();
          });

          expect(screen.getByText('orders.clientSelectLabel')).toBeInTheDocument();
     });

     it('should fetch clients on mount', async () => {
          render(<ClientSelect selectedClientId={null} shouldValidate={false} onSelect={mockOnSelect} />);

          await waitFor(() => {
               expect(mockExecuteApiCallWithDefault).toHaveBeenCalled();
          });
     });

     it('should display selected client as a chip', async () => {
          render(<ClientSelect selectedClientId="c1" shouldValidate={false} onSelect={mockOnSelect} />);

          await waitFor(() => {
               expect(mockExecuteApiCallWithDefault).toHaveBeenCalled();
          });

          await waitFor(() => {
               expect(screen.getByText('Brewery Pub')).toBeInTheDocument();
          });
     });

     it('should show validation error when shouldValidate is true and no client selected', async () => {
          render(<ClientSelect selectedClientId={null} shouldValidate onSelect={mockOnSelect} />);

          await waitFor(() => {
               expect(mockExecuteApiCallWithDefault).toHaveBeenCalled();
          });

          const label = screen.getByText('orders.clientSelectLabel');
          expect(label.closest('.Mui-error') ?? label.classList.contains('Mui-error')).toBeTruthy();
     });

     it('should show validation error when shouldValidate is true and selectedClientId is empty string', async () => {
          render(<ClientSelect selectedClientId="" shouldValidate onSelect={mockOnSelect} />);

          await waitFor(() => {
               expect(mockExecuteApiCallWithDefault).toHaveBeenCalled();
          });

          const label = screen.getByText('orders.clientSelectLabel');
          expect(label.closest('.Mui-error') ?? label.classList.contains('Mui-error')).toBeTruthy();
     });

     it('should not show validation error when shouldValidate is false', async () => {
          render(<ClientSelect selectedClientId={null} shouldValidate={false} onSelect={mockOnSelect} />);

          await waitFor(() => {
               expect(mockExecuteApiCallWithDefault).toHaveBeenCalled();
          });

          const label = screen.getByText('orders.clientSelectLabel');
          const errorElement = label.closest('.Mui-error');
          expect(errorElement).toBeNull();
     });

     it('should be disabled when disabled prop is true', async () => {
          render(<ClientSelect selectedClientId={null} shouldValidate={false} disabled onSelect={mockOnSelect} />);

          await waitFor(() => {
               expect(mockExecuteApiCallWithDefault).toHaveBeenCalled();
          });

          // MUI Select renders a hidden input with the disabled attribute
          const selectInput = screen.getByRole('combobox', { hidden: true });
          expect(selectInput).toHaveAttribute('aria-disabled', 'true');
     });
});
