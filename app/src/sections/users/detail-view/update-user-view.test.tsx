import { it, vi, expect, describe, beforeEach } from 'vitest';

import { UpdateUserDto } from 'src/api/Client';
import { screen, render, fireEvent } from 'src/test/test-utils';

import { UpdateUserView } from './update-user-view';

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
     useTranslation: () => ({ t: mockT }),
}));

const mockOnChange = vi.fn();

const createUser = (overrides?: Partial<InstanceType<typeof UpdateUserDto>>) =>
     new UpdateUserDto({
          firstName: 'John',
          lastName: 'Doe',
          userRoles: [],
          ...overrides,
     });

describe('UpdateUserView', () => {
     beforeEach(() => {
          vi.clearAllMocks();
     });

     it('should render first name and last name fields', () => {
          render(<UpdateUserView user={createUser()} shouldValidate={false} onChange={mockOnChange} />);

          expect(screen.getByDisplayValue('John')).toBeInTheDocument();
          expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
     });

     it('should render first name label', () => {
          render(<UpdateUserView user={createUser()} shouldValidate={false} onChange={mockOnChange} />);

          expect(screen.getAllByText('users.firstName')[0]).toBeInTheDocument();
     });

     it('should render last name label', () => {
          render(<UpdateUserView user={createUser()} shouldValidate={false} onChange={mockOnChange} />);

          expect(screen.getAllByText('users.lastName')[0]).toBeInTheDocument();
     });

     it('should render user roles section', () => {
          render(<UpdateUserView user={createUser()} shouldValidate={false} onChange={mockOnChange} />);

          expect(screen.getByText('users.userRoles')).toBeInTheDocument();
     });

     it('should render role checkboxes', () => {
          render(<UpdateUserView user={createUser()} shouldValidate={false} onChange={mockOnChange} />);

          // UserRoleType has Admin=0 and User=1
          expect(screen.getByText('UserRoleType.Admin')).toBeInTheDocument();
          expect(screen.getByText('UserRoleType.User')).toBeInTheDocument();
     });

     it('should call onChange when first name changes', () => {
          render(<UpdateUserView user={createUser()} shouldValidate={false} onChange={mockOnChange} />);

          const firstNameInput = screen.getByDisplayValue('John');
          fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

          expect(mockOnChange).toHaveBeenCalled();
          const calledWith = mockOnChange.mock.calls[0][0];
          expect(calledWith.firstName).toBe('Jane');
     });

     it('should call onChange when last name changes', () => {
          render(<UpdateUserView user={createUser()} shouldValidate={false} onChange={mockOnChange} />);

          const lastNameInput = screen.getByDisplayValue('Doe');
          fireEvent.change(lastNameInput, { target: { value: 'Smith' } });

          expect(mockOnChange).toHaveBeenCalled();
          const calledWith = mockOnChange.mock.calls[0][0];
          expect(calledWith.lastName).toBe('Smith');
     });

     it('should show error on roles section when shouldValidate is true and no roles selected', () => {
          render(<UpdateUserView user={createUser({ userRoles: [] })} shouldValidate onChange={mockOnChange} />);

          const rolesLabel = screen.getByText('users.userRoles');
          expect(rolesLabel).toHaveClass('Mui-error');
     });

     it('should not show error on roles section when roles are selected', () => {
          render(
               <UpdateUserView
                    user={createUser({ userRoles: ['Admin' as any] })}
                    shouldValidate
                    onChange={mockOnChange}
               />
          );

          const rolesLabel = screen.getByText('users.userRoles');
          expect(rolesLabel).not.toHaveClass('Mui-error');
     });
});
