/**
 * The colours the two kinds of stop that have no colour of their own are drawn in.
 *
 * A brewery brings its own — it is the colour it wears in the ceník tab strip and on the route
 * map, so a dovoz never has to invent one. A supplier has no such field and a custom waypoint is
 * not an entity at all, so both need one fixed tone each: shared here rather than repeated per
 * component, since the route map pin, the stop card and the cart's dot all have to agree or the
 * dot stops being a way to tell where a line came from.
 */

/** Suppliers — a slate that reads as "not a brewery" against the brewery palette. */
export const SUPPLIER_COLOR = '#0E7C9B';

/** Custom waypoints — the deep navy the editor's custom stop card has always used. */
export const CUSTOM_COLOR = '#1A2B4C';
