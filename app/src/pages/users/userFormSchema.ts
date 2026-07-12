import { z } from 'zod';

// ---------------------------------------------------------------------------
// Update form (inline detail)
// ---------------------------------------------------------------------------

export const userSchema = z.object({
     firstName: z.string().optional().or(z.literal('')),
     lastName: z.string().optional().or(z.literal('')),
     userRoles: z.array(z.number()),
});

export type UserFormValues = z.infer<typeof userSchema>;

export const defaultValues: UserFormValues = {
     firstName: '',
     lastName: '',
     userRoles: [],
};

// ---------------------------------------------------------------------------
// Create form (drawer)
// ---------------------------------------------------------------------------

export const createUserSchema = z.object({
     userName: z.string().min(1),
     password: z.string().min(1),
     firstName: z.string().optional().or(z.literal('')),
     lastName: z.string().optional().or(z.literal('')),
     userRoles: z.array(z.number()),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const createDefaultValues: CreateUserFormValues = {
     userName: '',
     password: '',
     firstName: '',
     lastName: '',
     userRoles: [],
};
