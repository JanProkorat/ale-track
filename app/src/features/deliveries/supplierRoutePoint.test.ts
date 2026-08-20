import { describe, expect, it } from 'vitest';
import type { SupplierDto } from 'src/generated/api-client';
import { supplierRoutePoint } from './supplierRoutePoint';

function supplier(official: [number, number] | null, contact?: [number | null, number | null]): SupplierDto {
  return {
    officialAddress: official ? { latitude: official[0], longitude: official[1] } : {},
    contactAddress: contact ? { latitude: contact[0], longitude: contact[1] } : undefined,
  } as SupplierDto;
}

describe('supplierRoutePoint', () => {
  it('prefers the branch actually visited when it is geocoded', () => {
    expect(supplierRoutePoint(supplier([50.08, 14.44], [50.77, 15.05])))
      .toEqual({ lat: 50.77, lng: 15.05 });
  });

  it('falls back to the registered seat when there is no branch address', () => {
    expect(supplierRoutePoint(supplier([50.08, 14.44]))).toEqual({ lat: 50.08, lng: 14.44 });
  });

  /**
   * The bug this guards: testing each coordinate separately would take the latitude from the seat
   * and the longitude from the branch, putting the pin in a field somewhere between them.
   */
  it('takes both coordinates from the seat when the branch is not geocoded', () => {
    expect(supplierRoutePoint(supplier([50.08, 14.44], [null, null])))
      .toEqual({ lat: 50.08, lng: 14.44 });
  });

  it('has no point at all for a supplier whose addresses are ungeocoded', () => {
    expect(supplierRoutePoint(supplier(null))).toEqual({ lat: undefined, lng: undefined });
  });

  it('has no point while the supplier has not loaded', () => {
    expect(supplierRoutePoint(undefined)).toEqual({ lat: undefined, lng: undefined });
  });
});
