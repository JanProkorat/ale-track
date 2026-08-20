/** Sort key for the orders list: newest-created order first. Orders without a
 * creation date (older rows predating the column) sort last. */
export function sortOrdersNewestFirst<T extends { createdDate?: Date }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = a.createdDate ? new Date(a.createdDate).getTime() : -Infinity;
    const tb = b.createdDate ? new Date(b.createdDate).getTime() : -Infinity;
    return tb - ta;
  });
}
