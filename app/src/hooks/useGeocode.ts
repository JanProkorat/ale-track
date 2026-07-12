import { useState } from 'react';

import { geocodeAddress } from 'src/utils/geocode';

export function useGeocode() {
     const [isGeocoding, setIsGeocoding] = useState(false);

     const geocode = async (address: {
          streetName: string;
          streetNumber: string;
          city: string;
          zip: string;
          country: string;
     }) => {
          setIsGeocoding(true);
          try {
               return await geocodeAddress(address);
          } finally {
               setIsGeocoding(false);
          }
     };

     return { geocode, isGeocoding };
}
