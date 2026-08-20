/** How a wrapping segmented track lays out on a phone. Free wrapping orphans the
 * last option on a row of its own — six filters at 360px leave one lonely pill —
 * so the mobile track becomes a grid whose rows are full.
 *
 * `columns: 0` means "don't grid": three or fewer options already fit one line,
 * and gridding them would stretch a control meant to hug its content, like the
 * reports' Týdně/Měsíčně toggle sitting beside a card title.
 *
 * Some counts have no orphan-free uniform grid at all — 7 leaves one over at
 * both 2 and 3 across — so a lone last option spans its whole row instead. */
export function mobileGrid(count: number): { columns: number; lastSpansRow: boolean } {
  if (count <= 3) {
    return { columns: 0, lastSpansRow: false };
  }
  const emptyWithThree = (3 - (count % 3)) % 3;
  const emptyWithTwo = count % 2;
  const columns = emptyWithThree <= emptyWithTwo ? 3 : 2;
  return { columns, lastSpansRow: count % columns === 1 };
}
