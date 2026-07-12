import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const availabilitySchema = z.object({
     from: z.any().nullable(),
     until: z.any().nullable(),
});

export const driverSchema = z.object({
     firstName: z.string().min(1),
     lastName: z.string().min(1),
     phoneNumber: z.string().optional().or(z.literal('')),
     color: z.string().min(1),
     availableDates: z.array(availabilitySchema),
});

export type DriverFormValues = z.infer<typeof driverSchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const defaultValues: DriverFormValues = {
     firstName: '',
     lastName: '',
     phoneNumber: '',
     color: '#6366f1',
     availableDates: [],
};
