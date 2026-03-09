import { z } from 'zod';

import {
     Country,
     AddressDto,
} from 'src/generated/api-client';

import i18n from 'src/i18n/i18n';

// ---------------------------------------------------------------------------
// Helpers — extract string keys from TypeScript numeric enums
// ---------------------------------------------------------------------------

function enumStringKeys<T extends Record<string, string | number>>(enumObj: T): string[] {
     return Object.keys(enumObj).filter((key) => isNaN(Number(key)));
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const req = () => i18n.t('common.required');

export const addressSchema = z.object({
     streetName: z.string().min(1, { message: req() }),
     streetNumber: z.string().min(1, { message: req() }),
     city: z.string().min(1, { message: req() }),
     zip: z.string().min(1, { message: req() }),
     country: z.enum(enumStringKeys(Country) as [string, ...string[]]),
     latitude: z.number().optional(),
     longitude: z.number().optional(),
});

export const brewerySchema = z
     .object({
          name: z.string().min(1, { message: req() }),
          color: z.string().min(1, { message: req() }),
          officialAddress: addressSchema,
          hasContactAddress: z.boolean(),
          contactAddress: z.any().optional(),
     })
     .superRefine((data, ctx) => {
          if (data.hasContactAddress) {
               const result = addressSchema.safeParse(data.contactAddress);
               if (!result.success) {
                    for (const issue of result.error.issues) {
                         ctx.addIssue({
                              ...issue,
                              path: ['contactAddress', ...issue.path],
                         });
                    }
               }
          }
     });

export type BreweryFormValues = z.infer<typeof brewerySchema>;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const defaultAddress = {
     streetName: '',
     streetNumber: '',
     city: '',
     zip: '',
     country: 'Czechia' as string,
     latitude: undefined as number | undefined,
     longitude: undefined as number | undefined,
};

export const defaultValues: BreweryFormValues = {
     name: '',
     color: '#6366f1',
     officialAddress: defaultAddress,
     hasContactAddress: false,
     contactAddress: defaultAddress,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function buildAddressDto(address: z.infer<typeof addressSchema>): AddressDto {
     const dto = new AddressDto();
     dto.streetName = address.streetName;
     dto.streetNumber = address.streetNumber;
     dto.city = address.city;
     dto.zip = address.zip;
     dto.country = address.country as unknown as Country;
     dto.latitude = address.latitude;
     dto.longitude = address.longitude;
     return dto;
}
