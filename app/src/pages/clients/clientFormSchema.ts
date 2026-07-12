import { z } from 'zod';

import i18n from 'src/i18n/i18n';
import {
     Region,
     Country,
     AddressDto,
     ContactType,
} from 'src/generated/api-client';

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

export const contactSchema = z.object({
     type: z.enum(enumStringKeys(ContactType) as [string, ...string[]]),
     value: z.string().min(1, { message: req() }),
     description: z.string().optional(),
});

export const clientSchema = z
     .object({
          name: z.string().min(1, { message: req() }),
          businessName: z.string().optional(),
          region: z.enum(enumStringKeys(Region) as [string, ...string[]]),
          officialAddress: addressSchema,
          hasContactAddress: z.boolean(),
          contactAddress: z.any().optional(),
          contacts: z.array(contactSchema),
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

export type ClientFormValues = z.infer<typeof clientSchema>;

// ---------------------------------------------------------------------------
// Enum option lists (values are string keys matching API responses)
// ---------------------------------------------------------------------------

export const regionOptions = enumStringKeys(Region).map((key) => ({
     value: key,
     labelKey: `enums.region.${key}`,
}));

export const contactTypeOptions = enumStringKeys(ContactType).map((key) => ({
     value: key,
     labelKey: `enums.contactType.${key}`,
}));

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

export const defaultValues: ClientFormValues = {
     name: '',
     businessName: '',
     region: 'ZittauCity',
     officialAddress: defaultAddress,
     hasContactAddress: false,
     contactAddress: defaultAddress,
     contacts: [],
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
