// Replicated from DeliveryStopsEditor.tsx for testing (not exported)

interface SizeGroup {
  size: string;
  products: {
    id?: string;
    name?: string | undefined;
    kind?: number | null;
    packageSize?: number | null;
    displayOrder?: number | null;
  }[];
}

interface KindGroup {
  kind: string;
  sizes: SizeGroup[];
}

type Product = SizeGroup['products'][number];

function buildTree(
  products: Product[],
  enumLabel: { productKind: (k: number) => string },
): KindGroup[] {
  const kindMap = new Map<string, Map<string, Product[]>>();
  const kindOrderMap = new Map<string, number>();

  for (const p of products) {
    const kind = p.kind != null ? enumLabel.productKind(p.kind) : '—';
    const size = p.packageSize != null ? `${p.packageSize} L` : '—';
    if (!kindMap.has(kind)) kindMap.set(kind, new Map());
    const sizeMap = kindMap.get(kind)!;
    if (!sizeMap.has(size)) sizeMap.set(size, []);
    sizeMap.get(size)!.push(p);
    if (p.displayOrder != null) {
      const current = kindOrderMap.get(kind);
      if (current == null || p.displayOrder < current) {
        kindOrderMap.set(kind, p.displayOrder);
      }
    }
  }

  const result: KindGroup[] = [];
  for (const [kind, sizeMap] of [...kindMap.entries()].sort((a, b) => {
    const orderA = kindOrderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
    const orderB = kindOrderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a[0].localeCompare(b[0]);
  })) {
    const sizes: SizeGroup[] = [];
    for (const [size, prods] of [...sizeMap.entries()].sort(([a], [b]) => {
      const na = parseFloat(a) || 0;
      const nb = parseFloat(b) || 0;
      return na - nb;
    })) {
      sizes.push({
        size,
        products: prods.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
      });
    }
    result.push({ kind, sizes });
  }
  return result;
}

// --- Tests ---

const enumLabel = {
  productKind: (k: number) => ['Lager', 'Ale', 'Stout'][k] ?? 'Unknown',
};

describe('buildTree', () => {
  it('returns empty array for empty products', () => {
    expect(buildTree([], enumLabel)).toEqual([]);
  });

  it('groups products by kind label', () => {
    const products: Product[] = [
      { id: '1', name: 'Pilsner', kind: 0, packageSize: 0.5, displayOrder: 1 },
      { id: '2', name: 'IPA', kind: 1, packageSize: 0.5, displayOrder: 2 },
    ];
    const result = buildTree(products, enumLabel);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('Lager');
    expect(result[1].kind).toBe('Ale');
  });

  it('groups products by package size within kind', () => {
    const products: Product[] = [
      { id: '1', name: 'Pilsner Small', kind: 0, packageSize: 0.5, displayOrder: 1 },
      { id: '2', name: 'Pilsner Large', kind: 0, packageSize: 1, displayOrder: 1 },
    ];
    const result = buildTree(products, enumLabel);
    expect(result).toHaveLength(1);
    expect(result[0].sizes).toHaveLength(2);
    expect(result[0].sizes[0].size).toBe('0.5 L');
    expect(result[0].sizes[1].size).toBe('1 L');
  });

  it('sorts kinds by displayOrder (lowest first)', () => {
    const products: Product[] = [
      { id: '1', name: 'Stout A', kind: 2, packageSize: 0.5, displayOrder: 10 },
      { id: '2', name: 'Lager A', kind: 0, packageSize: 0.5, displayOrder: 1 },
      { id: '3', name: 'Ale A', kind: 1, packageSize: 0.5, displayOrder: 5 },
    ];
    const result = buildTree(products, enumLabel);
    expect(result.map((g) => g.kind)).toEqual(['Lager', 'Ale', 'Stout']);
  });

  it('kinds without displayOrder come last, sorted alphabetically', () => {
    const products: Product[] = [
      { id: '1', name: 'Ale A', kind: 1, packageSize: 0.5, displayOrder: null },
      { id: '2', name: 'Lager A', kind: 0, packageSize: 0.5, displayOrder: 2 },
      { id: '3', name: 'Stout A', kind: 2, packageSize: 0.5, displayOrder: null },
    ];
    const result = buildTree(products, enumLabel);
    expect(result.map((g) => g.kind)).toEqual(['Lager', 'Ale', 'Stout']);
  });

  it('sorts sizes numerically within a kind (0.5 L < 1 L < 50 L)', () => {
    const products: Product[] = [
      { id: '1', name: 'Beer 50', kind: 0, packageSize: 50, displayOrder: 1 },
      { id: '2', name: 'Beer 0.5', kind: 0, packageSize: 0.5, displayOrder: 1 },
      { id: '3', name: 'Beer 1', kind: 0, packageSize: 1, displayOrder: 1 },
    ];
    const result = buildTree(products, enumLabel);
    expect(result[0].sizes.map((s) => s.size)).toEqual(['0.5 L', '1 L', '50 L']);
  });

  it('sorts products alphabetically within a size group', () => {
    const products: Product[] = [
      { id: '1', name: 'Zephyr', kind: 0, packageSize: 0.5, displayOrder: 1 },
      { id: '2', name: 'Alpha', kind: 0, packageSize: 0.5, displayOrder: 1 },
      { id: '3', name: 'Medium', kind: 0, packageSize: 0.5, displayOrder: 1 },
    ];
    const result = buildTree(products, enumLabel);
    const names = result[0].sizes[0].products.map((p) => p.name);
    expect(names).toEqual(['Alpha', 'Medium', 'Zephyr']);
  });

  it("uses '—' for null kind", () => {
    const products: Product[] = [
      { id: '1', name: 'Mystery', kind: null, packageSize: 1, displayOrder: null },
    ];
    const result = buildTree(products, enumLabel);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('—');
  });

  it("uses '—' for null packageSize", () => {
    const products: Product[] = [
      { id: '1', name: 'No Size', kind: 0, packageSize: null, displayOrder: 1 },
    ];
    const result = buildTree(products, enumLabel);
    expect(result[0].sizes).toHaveLength(1);
    expect(result[0].sizes[0].size).toBe('—');
  });

  it('multiple products in same kind+size are sorted by name', () => {
    const products: Product[] = [
      { id: '1', name: 'Charlie', kind: 1, packageSize: 0.5, displayOrder: 1 },
      { id: '2', name: 'Alice', kind: 1, packageSize: 0.5, displayOrder: 1 },
      { id: '3', name: 'Bob', kind: 1, packageSize: 0.5, displayOrder: 1 },
    ];
    const result = buildTree(products, enumLabel);
    expect(result).toHaveLength(1);
    expect(result[0].sizes).toHaveLength(1);
    const names = result[0].sizes[0].products.map((p) => p.name);
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});
