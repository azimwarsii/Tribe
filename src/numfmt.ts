/** A USD price as a plain decimal string Flash accepts: cents for $1+, enough significant digits below that. */
export function priceStr(p: number): string {
  if (!(p > 0)) return "0";
  if (p >= 1) return p.toFixed(2);
  const d = Math.min(18, Math.ceil(-Math.log10(p)) + 4);
  return p.toFixed(d);
}

/** A token amount as a plain decimal string (never exponent notation). */
export function qtyStr(n: number): string {
  if (!(n > 0)) return "0";
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(Math.min(18, Math.ceil(-Math.log10(n)) + 6));
}
