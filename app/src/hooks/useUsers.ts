// Users module hooks — copied from the useVehicles CRUD pattern. There is no
// user-detail endpoint (the list item already carries everything), so this
// module skips the `useVehicle`-style detail hook.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';
import { type CreateUserDto, type UpdateUserDto } from 'src/generated/api-client';

export function useUsers(params: Record<string, string> = {}) {
  const ds = useDataSource();
  return useQuery({
    queryKey: qk.users.list(params),
    queryFn: ({ signal }) => ds.getUserListEndpoint(params, signal),
  });
}

export function useCreateUser() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserDto) => ds.createUserEndpoint(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users.all }),
  });
}

export function useUpdateUser() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) =>
      ds.updateUserEndpoint(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: qk.users.all });
      qc.invalidateQueries({ queryKey: qk.users.detail(id) });
    },
  });
}

export function useDeleteUser() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteUserEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users.all }),
  });
}
