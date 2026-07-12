import type { Column } from 'src/components/common/DataTable';

import { screen, userEvent, renderWithProviders } from 'src/test/test-utils';

import DataTable from 'src/components/common/DataTable';

vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: (key: string) => key }),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

interface TestRow {
     id: string;
     name: string;
     age: number;
}

const columns: Column<TestRow>[] = [
     { id: 'name', label: 'Name' },
     { id: 'age', label: 'Age' },
];

const rows: TestRow[] = [
     { id: '1', name: 'Alice', age: 30 },
     { id: '2', name: 'Bob', age: 25 },
];

const getId = (row: TestRow) => row.id;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataTable', () => {
     it('renders column headers', () => {
          renderWithProviders(<DataTable columns={columns} rows={rows} getId={getId} />);

          expect(screen.getByText('Name')).toBeInTheDocument();
          expect(screen.getByText('Age')).toBeInTheDocument();
     });

     it('renders row data using property access by column id', () => {
          renderWithProviders(<DataTable columns={columns} rows={rows} getId={getId} />);

          expect(screen.getByText('Alice')).toBeInTheDocument();
          expect(screen.getByText('30')).toBeInTheDocument();
          expect(screen.getByText('Bob')).toBeInTheDocument();
          expect(screen.getByText('25')).toBeInTheDocument();
     });

     it('shows loading spinner when loading=true', () => {
          renderWithProviders(<DataTable columns={columns} rows={rows} getId={getId} loading />);

          expect(screen.getByRole('progressbar')).toBeInTheDocument();
     });

     it('shows empty state when rows is empty and not loading', () => {
          renderWithProviders(<DataTable columns={columns} rows={[]} getId={getId} />);

          expect(screen.getByText('common.noData')).toBeInTheDocument();
     });

     it('does not show table when loading', () => {
          renderWithProviders(<DataTable columns={columns} rows={rows} getId={getId} loading />);

          expect(screen.queryByText('Alice')).not.toBeInTheDocument();
          expect(screen.queryByText('Bob')).not.toBeInTheDocument();
     });

     it('does not show table when rows is empty', () => {
          renderWithProviders(<DataTable columns={columns} rows={[]} getId={getId} />);

          expect(screen.queryByRole('table')).not.toBeInTheDocument();
     });

     it('shows search field when onSearchChange is provided', () => {
          renderWithProviders(
               <DataTable columns={columns} rows={rows} getId={getId} onSearchChange={() => {}} />,
          );

          expect(screen.getByPlaceholderText('common.search')).toBeInTheDocument();
     });

     it('does not show search field when onSearchChange is not provided', () => {
          renderWithProviders(<DataTable columns={columns} rows={rows} getId={getId} />);

          expect(screen.queryByPlaceholderText('common.search')).not.toBeInTheDocument();
     });

     it('calls onSearchChange when typing in search field', async () => {
          const onSearchChange = vi.fn();
          const user = userEvent.setup();

          renderWithProviders(
               <DataTable
                    columns={columns}
                    rows={rows}
                    getId={getId}
                    searchValue=""
                    onSearchChange={onSearchChange}
               />,
          );

          await user.type(screen.getByPlaceholderText('common.search'), 'test');

          expect(onSearchChange).toHaveBeenCalledWith('t');
          expect(onSearchChange).toHaveBeenCalledTimes(4);
     });

     it('calls onRowClick when clicking a row', async () => {
          const onRowClick = vi.fn();
          const user = userEvent.setup();

          renderWithProviders(
               <DataTable columns={columns} rows={rows} getId={getId} onRowClick={onRowClick} />,
          );

          await user.click(screen.getByText('Alice'));

          expect(onRowClick).toHaveBeenCalledWith(rows[0]);
     });

     it('uses custom render function when provided in column', () => {
          const customColumns: Column<TestRow>[] = [
               { id: 'name', label: 'Name', render: (row) => `Custom: ${row.name}` },
               { id: 'age', label: 'Age' },
          ];

          renderWithProviders(<DataTable columns={customColumns} rows={rows} getId={getId} />);

          expect(screen.getByText('Custom: Alice')).toBeInTheDocument();
          expect(screen.getByText('Custom: Bob')).toBeInTheDocument();
     });

     it('handles null values in rows (renders empty string)', () => {
          interface NullableRow {
               id: string;
               name: string | null;
          }

          const nullableColumns: Column<NullableRow>[] = [{ id: 'name', label: 'Name' }];
          const nullableRows: NullableRow[] = [{ id: '1', name: null }];

          const { container } = renderWithProviders(
               <DataTable
                    columns={nullableColumns}
                    rows={nullableRows}
                    getId={(row) => row.id}
               />,
          );

          // The table body cell should render an empty string for null values
          const bodyCells = container.querySelectorAll('tbody td');
          expect(bodyCells).toHaveLength(1);
          expect(bodyCells[0].textContent).toBe('');
     });
});
