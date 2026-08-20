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

  it('tolerates a client with no id or name', () => {
    const rows = clientComboOptions([ClientDto.fromJS({ region: 'Berlin' })]);
    expect(rows).toEqual([{ value: '', label: '', group: 'Berlín' }]);
  });

  it('returns nothing for no clients', () => {
    expect(clientComboOptions([])).toEqual([]);
  });
});
