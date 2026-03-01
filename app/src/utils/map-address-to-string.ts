import type { IAddressDto } from 'src/api/Client';

import { Country } from 'src/api/Client';

export function addressToString(address: IAddressDto): string {
     const parts = [
          [address.streetName, address.streetNumber].filter(Boolean).join(' '),
          [address.zip, address.city].filter(Boolean).join(' '),
          countryMap[address.country],
     ];

     return parts.filter(Boolean).join(', ');
}

const countryMap: Record<Country, string> = {
     [Country.Czechia]: 'Czech Republic',
     [Country.Germany]: 'Germany',
};
