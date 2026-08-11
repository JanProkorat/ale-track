// Build Combobox options from the generated numeric enums, labelled in Czech.
// The option `value` is the numeric enum member as a string (parse back with
// Number(...)); the label falls back to the enum name when no Czech label exists.
import { ProductKind, ProductType, ProductContainer, ProductSaleUnit } from 'src/generated/api-client';
import { kindLabel, ptypeLabel, containerLabel, saleUnitLabel } from './labels';
import { type ComboOption } from 'src/components/common/Combobox';

export function enumOptions(
  e: Record<string, string | number>,
  labeler: (v: number) => string | undefined
): ComboOption[] {
  return Object.values(e)
    .filter((v): v is number => typeof v === 'number')
    .map((v) => ({ value: String(v), label: labeler(v) ?? String(v) }));
}

export const KIND_OPTIONS = enumOptions(ProductKind, kindLabel);
export const PTYPE_OPTIONS = enumOptions(ProductType, ptypeLabel);
export const CONTAINER_OPTIONS = enumOptions(ProductContainer, containerLabel);
export const SALE_UNIT_OPTIONS = enumOptions(ProductSaleUnit, saleUnitLabel);
