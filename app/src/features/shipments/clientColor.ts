// Deterministic per-client color, shared by RouteMap pins and the nakládka
// stop avatars so a client's color stays stable between the two — same
// hash-based approach OrdersPage/OrderEditor use for their own tints.

const AVATAR_COLORS = ['#F08C00', '#0E7C9B', '#7C3AED', '#15873F', '#C22A2A', '#B4620A', '#0891B2', '#DB2777'];

export function colorForClient(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
