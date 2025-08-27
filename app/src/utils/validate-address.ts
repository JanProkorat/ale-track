import { t } from "i18next";

import type {AddressDto} from "../api/Client";

export function validateAddress(address: AddressDto | undefined): Record<string, string> {
    const validationErrors: Record<string, string> = {};
    if (!address) return validationErrors;

    const { streetName, streetNumber, city, zip, country } = address;

    if (!streetName) validationErrors.streetName = t('common.required');
    if (!streetNumber) validationErrors.streetNumber = t('common.required');
    if (!city) validationErrors.city = t('common.required');
    if (!zip) validationErrors.zip = t('common.required');
    if (!country) validationErrors.country = t('common.required');

    return validationErrors;
};