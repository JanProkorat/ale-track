import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserListItemDto, UserRoleType } from 'src/generated/api-client';
import { UserFormDrawer } from './UserFormDrawer';

vi.mock('src/hooks/useDrivers', () => ({
  useDrivers: () => ({
    data: [
      { id: 'd1', firstName: 'Jan', lastName: 'Novák' },
      { id: 'd2', firstName: 'Petr', lastName: 'Svoboda', isLinkedToUser: true },
    ],
    isPending: false,
    isError: false,
  }),
}));

vi.mock('src/hooks/useUsers', () => ({
  useCreateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// The role radio option is itself labelled "Řidič" (`ROLE_LABELS[UserRoleType.Driver]`),
// so a plain `getByLabelText('Řidič')` matches that radio too — it either finds the radio
// before the picker exists (a false pass) or throws "multiple elements found" once the
// picker is also on screen. Querying the picker by its `combobox` role instead of by label
// text sidesteps that collision without changing what's asserted: is the driver picker
// present or not.
const driverPicker = () => screen.queryByRole('combobox', { name: 'Řidič' });

describe('UserFormDrawer driver link', () => {
  it('hides the driver picker for a manager', () => {
    render(<UserFormDrawer open onClose={() => {}} />);
    expect(driverPicker()).not.toBeInTheDocument();
  });

  it('shows the driver picker once the Driver role is picked', () => {
    render(<UserFormDrawer open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Řidič' }));
    expect(driverPicker()).toBeInTheDocument();
  });

  it('clears the chosen driver when the role changes away from Driver', () => {
    render(<UserFormDrawer open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Řidič' }));

    fireEvent.mouseDown(driverPicker()!);
    fireEvent.click(screen.getByText('Jan Novák'));
    expect(driverPicker()).toHaveValue('Jan Novák');

    fireEvent.click(screen.getByRole('radio', { name: 'Manažer' }));
    expect(driverPicker()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Řidič' }));
    expect(driverPicker()).toHaveValue('');
  });

  it('excludes a driver already linked to another account from the picker options', () => {
    render(<UserFormDrawer open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Řidič' }));

    fireEvent.mouseDown(driverPicker()!);

    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    expect(screen.queryByText('Petr Svoboda')).not.toBeInTheDocument();
  });

  it("keeps the account's own currently linked driver in the options", () => {
    const user = new UserListItemDto({
      id: 'u1',
      userName: 'petrsvoboda',
      userRoles: [UserRoleType.Driver],
      permissions: [],
      driverId: 'd2',
    });

    render(<UserFormDrawer open user={user} onClose={() => {}} />);

    fireEvent.mouseDown(driverPicker()!);

    expect(screen.getByText('Petr Svoboda')).toBeInTheDocument();
  });
});
