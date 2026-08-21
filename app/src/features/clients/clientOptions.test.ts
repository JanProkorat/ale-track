import { describe, it, expect } from 'vitest';
import { ClientDto } from 'src/generated/api-client';
import { clientComboOptions } from './clientOptions';

/** `fromJS`, not the constructor: the API sends enums as their member name, so
 * a loaded client's `region` is the string "Leipzig", not the numeric enum. */
function client(name: string, region?: string) {
  return ClientDto.fromJS({ id: name.toLowerCase(), name, region });
}

describe('clientComboOptions', () => {
  it('groups clients under their region label', () => {
    const rows = clientComboOptions([client('Adam', 'Leipzig'), client('Bára', 'Berlin')]);
    expect(rows).toEqual([
      { value: 'bára', label: 'Bára', group: 'Berlín' },
      { value: 'adam', label: 'Adam', group: 'Lipsko' },
    ]);
  });

  it('sorts clients inside a region by name with Czech collation', () => {
    const rows = clientComboOptions([
      client('Švejk', 'Leipzig'), client('Sedlák', 'Leipzig'), client('Čapek', 'Leipzig'), client('Cimrman', 'Leipzig'),
    ]);
    expect(rows.map((r) => r.label)).toEqual(['Cimrman', 'Čapek', 'Sedlák', 'Švejk']);
  });

  it('orders the regions by their Czech label', () => {
    const rows = clientComboOptions([client('A', 'Leipzig'), client('B', 'Berlin'), client('C', 'Chemnitz')]);
    expect(rows.map((r) => r.group)).toEqual(['Berlín', 'Chemnitz', 'Lipsko']);
  });

  it('pins clients with no region last, under Ostatní', () => {
    const rows = clientComboOptions([client('Bez'), client('Adam', 'Leipzig')]);
    expect(rows.map((r) => r.group)).toEqual(['Lipsko', 'Ostatní']);
  });

  it('folds the Other region into the same Ostatní group as a missing one', () => {
    const rows = clientComboOptions([client('Bez'), client('Jiny', 'Other')]);
    expect(rows.map((r) => r.group)).toEqual(['Ostatní', 'Ostatní']);
    expect(rows.map((r) => r.label)).toEqual(['Bez', 'Jiny']);
  });

  /** Reported: two clients may share a name and differ only in their trading name, and the
   *  picker offered two rows that read identically. */
  it('carries the trading name as the option’s second line', () => {
    const rows = clientComboOptions([
      ClientDto.fromJS({ id: 'gastro', name: 'Hospoda Na Rohu', businessName: 'Na Rohu gastro s.r.o.', region: 'Leipzig' }),
      ClientDto.fromJS({ id: 'family', name: 'Hospoda Na Rohu', businessName: 'Jan Vrána', region: 'Leipzig' }),
    ]);

    // Same label, so the second line is the only thing telling them apart — and it decides
    // their order, so the pair does not shuffle between renders.
    expect(rows.map((r) => r.secondary)).toEqual(['Jan Vrána', 'Na Rohu gastro s.r.o.']);
    expect(rows.map((r) => r.value)).toEqual(['family', 'gastro']);
  });

  it('leaves the second line off a client with no trading name', () => {
    // Optional on the client. An empty string would render a blank line and make the row
    // taller than its neighbours for nothing.
    const rows = clientComboOptions([
      ClientDto.fromJS({ id: 'a', name: 'Pivnice U Kapra', region: 'Leipzig' }),
      ClientDto.fromJS({ id: 'b', name: 'Pivnice U Raka', businessName: '   ', region: 'Leipzig' }),
    ]);

    expect(rows.map((r) => r.secondary)).toEqual([undefined, undefined]);
  });

  it('tolerates a client with no id or name', () => {
    const rows = clientComboOptions([ClientDto.fromJS({ region: 'Berlin' })]);
    expect(rows).toEqual([{ value: '', label: '', group: 'Berlín' }]);
  });

  it('returns nothing for no clients', () => {
    expect(clientComboOptions([])).toEqual([]);
  });
});
