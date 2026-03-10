// ---------------------------------------------------------------------------
// buildTree – replicated from AddExtraProductsDrawer (not exported)
// ---------------------------------------------------------------------------

interface ProductListItemDto {
  id?: string;
  name?: string;
  breweryName?: string;
  kind?: number;
  packageSize?: number;
  breweryDisplayOrder?: number;
  displayOrder?: number;
}

interface SizeGroup {
  size: string;
  products: ProductListItemDto[];
}

interface KindGroup {
  kind: string;
  sizes: SizeGroup[];
}

interface BreweryGroup {
  brewery: string;
  kinds: KindGroup[];
}

type EnumLabel = { productKind: (kind: number) => string };

function buildTree(products: ProductListItemDto[], enumLabel: EnumLabel): BreweryGroup[] {
  const brewMap = new Map<string, Map<string, Map<string, ProductListItemDto[]>>>();
  const breweryOrderMap = new Map<string, number>();
  const kindOrderMap = new Map<string, number>();

  for (const p of products) {
    const brew = p.breweryName ?? '—';
    const kind = p.kind != null ? enumLabel.productKind(p.kind) : '—';
    const size = p.packageSize != null ? `${p.packageSize} L` : '—';

    if (!brewMap.has(brew)) brewMap.set(brew, new Map());
    const kindMap = brewMap.get(brew)!;
    if (!kindMap.has(kind)) kindMap.set(kind, new Map());
    const sizeMap = kindMap.get(kind)!;
    if (!sizeMap.has(size)) sizeMap.set(size, []);
    sizeMap.get(size)!.push(p);

    if (p.breweryDisplayOrder != null) {
      const current = breweryOrderMap.get(brew);
      if (current == null || p.breweryDisplayOrder < current) {
        breweryOrderMap.set(brew, p.breweryDisplayOrder);
      }
    }

    const kindKey = `${brew}::${kind}`;
    if (p.displayOrder != null) {
      const current = kindOrderMap.get(kindKey);
      if (current == null || p.displayOrder < current) {
        kindOrderMap.set(kindKey, p.displayOrder);
      }
    }
  }

  const result: BreweryGroup[] = [];
  for (const [brewery, kindMap] of [...brewMap.entries()].sort((a, b) => {
    const orderA = breweryOrderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
    const orderB = breweryOrderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a[0].localeCompare(b[0]);
  })) {
    const kinds: KindGroup[] = [];
    for (const [kind, sizeMap] of [...kindMap.entries()].sort((a, b) => {
      const orderA = kindOrderMap.get(`${brewery}::${a[0]}`) ?? Number.MAX_SAFE_INTEGER;
      const orderB = kindOrderMap.get(`${brewery}::${b[0]}`) ?? Number.MAX_SAFE_INTEGER;
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
      kinds.push({ kind, sizes });
    }
    result.push({ brewery, kinds });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Mock enum label
// ---------------------------------------------------------------------------

const kindNames: Record<number, string> = { 0: 'Lager', 1: 'Ale', 2: 'Stout' };

const mockEnumLabel: EnumLabel = {
  productKind: (kind: number) => kindNames[kind] ?? `Unknown(${kind})`,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTree', () => {
  // ---- Basic grouping -----------------------------------------------------

  describe('Basic grouping', () => {
    it('returns empty array for empty products', () => {
      expect(buildTree([], mockEnumLabel)).toEqual([]);
    });

    it('groups products by brewery → kind → size', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'Pilsner', breweryName: 'BrewA', kind: 0, packageSize: 50 },
        { id: '2', name: 'IPA', breweryName: 'BrewA', kind: 1, packageSize: 30 },
        { id: '3', name: 'Dark Lager', breweryName: 'BrewB', kind: 0, packageSize: 50 },
      ];

      const tree = buildTree(products, mockEnumLabel);

      expect(tree).toHaveLength(2);

      const brewA = tree.find((b) => b.brewery === 'BrewA')!;
      expect(brewA).toBeDefined();
      expect(brewA.kinds).toHaveLength(2);

      const lagerKind = brewA.kinds.find((k) => k.kind === 'Lager')!;
      expect(lagerKind.sizes).toHaveLength(1);
      expect(lagerKind.sizes[0].size).toBe('50 L');
      expect(lagerKind.sizes[0].products).toHaveLength(1);

      const aleKind = brewA.kinds.find((k) => k.kind === 'Ale')!;
      expect(aleKind.sizes).toHaveLength(1);
      expect(aleKind.sizes[0].size).toBe('30 L');

      const brewB = tree.find((b) => b.brewery === 'BrewB')!;
      expect(brewB).toBeDefined();
      expect(brewB.kinds).toHaveLength(1);
    });

    it('correctly formats size labels ("50 L", "30 L", "—" for missing)', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Brew', kind: 0, packageSize: 50 },
        { id: '2', name: 'B', breweryName: 'Brew', kind: 0, packageSize: 30 },
        { id: '3', name: 'C', breweryName: 'Brew', kind: 0 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      const sizes = tree[0].kinds[0].sizes.map((s) => s.size);

      expect(sizes).toContain('50 L');
      expect(sizes).toContain('30 L');
      expect(sizes).toContain('—');
    });
  });

  // ---- Brewery sorting by breweryDisplayOrder -----------------------------

  describe('Brewery sorting by breweryDisplayOrder', () => {
    it('sorts breweries by breweryDisplayOrder ascending', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Zeta', kind: 0, breweryDisplayOrder: 2 },
        { id: '2', name: 'B', breweryName: 'Alpha', kind: 0, breweryDisplayOrder: 1 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      expect(tree.map((b) => b.brewery)).toEqual(['Alpha', 'Zeta']);
    });

    it('falls back to alphabetical when breweryDisplayOrder is equal', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Charlie', kind: 0, breweryDisplayOrder: 1 },
        { id: '2', name: 'B', breweryName: 'Alpha', kind: 0, breweryDisplayOrder: 1 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      expect(tree.map((b) => b.brewery)).toEqual(['Alpha', 'Charlie']);
    });

    it('breweries without breweryDisplayOrder go to the end', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'NoOrder', kind: 0 },
        { id: '2', name: 'B', breweryName: 'HasOrder', kind: 0, breweryDisplayOrder: 1 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      expect(tree.map((b) => b.brewery)).toEqual(['HasOrder', 'NoOrder']);
    });

    it('uses minimum breweryDisplayOrder when a brewery has products with different values', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Brew', kind: 0, breweryDisplayOrder: 5 },
        { id: '2', name: 'B', breweryName: 'Brew', kind: 1, breweryDisplayOrder: 2 },
        { id: '3', name: 'C', breweryName: 'Other', kind: 0, breweryDisplayOrder: 3 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      // Brew min order = 2, Other order = 3 → Brew first
      expect(tree.map((b) => b.brewery)).toEqual(['Brew', 'Other']);
    });
  });

  // ---- Kind sorting by displayOrder ---------------------------------------

  describe('Kind sorting by displayOrder', () => {
    it('sorts kinds within a brewery by displayOrder ascending', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Brew', kind: 2, displayOrder: 10 },
        { id: '2', name: 'B', breweryName: 'Brew', kind: 0, displayOrder: 1 },
        { id: '3', name: 'C', breweryName: 'Brew', kind: 1, displayOrder: 5 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      const sortedKindNames = tree[0].kinds.map((k) => k.kind);
      expect(sortedKindNames).toEqual(['Lager', 'Ale', 'Stout']);
    });

    it('falls back to alphabetical when displayOrder is equal', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Brew', kind: 2, displayOrder: 1 },
        { id: '2', name: 'B', breweryName: 'Brew', kind: 1, displayOrder: 1 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      const kindLabels = tree[0].kinds.map((k) => k.kind);
      // Ale < Stout alphabetically
      expect(kindLabels).toEqual(['Ale', 'Stout']);
    });

    it('kinds without displayOrder go to the end', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Brew', kind: 1 },
        { id: '2', name: 'B', breweryName: 'Brew', kind: 0, displayOrder: 1 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      const kindLabels = tree[0].kinds.map((k) => k.kind);
      expect(kindLabels).toEqual(['Lager', 'Ale']);
    });

    it('uses minimum displayOrder from products in that kind group', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Brew', kind: 1, displayOrder: 10 },
        { id: '2', name: 'B', breweryName: 'Brew', kind: 1, displayOrder: 2 },
        { id: '3', name: 'C', breweryName: 'Brew', kind: 0, displayOrder: 5 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      const kindLabels = tree[0].kinds.map((k) => k.kind);
      // Ale min displayOrder = 2, Lager displayOrder = 5 → Ale first
      expect(kindLabels).toEqual(['Ale', 'Lager']);
    });
  });

  // ---- Size sorting -------------------------------------------------------

  describe('Size sorting', () => {
    it('sorts sizes numerically (30 L before 50 L)', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Brew', kind: 0, packageSize: 50 },
        { id: '2', name: 'B', breweryName: 'Brew', kind: 0, packageSize: 30 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      const sizeLabels = tree[0].kinds[0].sizes.map((s) => s.size);
      expect(sizeLabels).toEqual(['30 L', '50 L']);
    });

    it('"—" (missing size) treated as 0', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'A', breweryName: 'Brew', kind: 0, packageSize: 30 },
        { id: '2', name: 'B', breweryName: 'Brew', kind: 0 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      const sizeLabels = tree[0].kinds[0].sizes.map((s) => s.size);
      // "—" parses to 0, which is before 30
      expect(sizeLabels).toEqual(['—', '30 L']);
    });
  });

  // ---- Product sorting within size groups ---------------------------------

  describe('Product sorting within size groups', () => {
    it('products sorted alphabetically by name within a size group', () => {
      const products: ProductListItemDto[] = [
        { id: '1', name: 'Zephyr', breweryName: 'Brew', kind: 0, packageSize: 50 },
        { id: '2', name: 'Alpha', breweryName: 'Brew', kind: 0, packageSize: 50 },
        { id: '3', name: 'Mango', breweryName: 'Brew', kind: 0, packageSize: 50 },
      ];

      const tree = buildTree(products, mockEnumLabel);
      const names = tree[0].kinds[0].sizes[0].products.map((p) => p.name);
      expect(names).toEqual(['Alpha', 'Mango', 'Zephyr']);
    });
  });
});
