import type { CreateUserDto, UpdateUserDto } from 'src/generated/api-client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useNotification } from 'src/hooks/useNotification';

import { apiClient } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const USERS_KEY = 'users';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useUsers(search?: string) {
     return useQuery({
          queryKey: [USERS_KEY, search],
          queryFn: ({ signal }) =>
               apiClient.getUserListEndpoint(
                    search ? { UserName: `contains:${search}` } : {},
                    signal,
               ),
     });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateUser() {
     const queryClient = useQueryClient();
     const { notifyCreate, notifyCreateError } = useNotification();

     return useMutation({
          mutationFn: (data: CreateUserDto) => apiClient.createUserEndpoint(data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
               notifyCreate('users');
          },
          onError: () => {
               notifyCreateError('users');
          },
     });
}

export function useUpdateUser() {
     const queryClient = useQueryClient();
     const { notifyUpdate, notifyApiError } = useNotification();

     return useMutation({
          mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) =>
               apiClient.updateUserEndpoint(id, data),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
               notifyUpdate('users');
          },
          onError: (error: unknown) => {
               notifyApiError(error);
          },
     });
}

export function useDeleteUser() {
     const queryClient = useQueryClient();
     const { notifyDelete, notifyDeleteError } = useNotification();

     return useMutation({
          mutationFn: (id: string) => apiClient.deleteUserEndpoint(id),
          onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
               notifyDelete('users');
          },
          onError: () => {
               notifyDeleteError('users');
          },
     });
}
