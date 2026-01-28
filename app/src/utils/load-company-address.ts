import type { AddressDto } from '../api/Client';

function loadCompanyAddress(): AddressDto {
  const raw = import.meta.env.VITE_COMPANY_ADDRESS;

  if (!raw) {
    throw new Error('Missing VITE_COMPANY_ADDRESS');
  }

  const parsed : AddressDto = JSON.parse(raw);

  if (parsed === undefined) {
    throw new Error('Invalid VITE_COMPANY_ADDRESS format');
  }

  return parsed;
}

export const COMPANY_ADDRESS = loadCompanyAddress();