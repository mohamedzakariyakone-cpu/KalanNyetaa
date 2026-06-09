export function formatNumberForLocale(value: number, locale = "fr-FR", maximumFractionDigits = 2) {
  const nf = new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
  return nf.format(value);
}

export function parseNumberFromString(input: string, locale = "fr-FR") {
  if (input === null || input === undefined) return NaN;
  let s = String(input).trim();
  if (s === "") return NaN;

  // remove non-breaking spaces and normal spaces
  s = s.replace(/\u00A0/g, "").replace(/\s/g, "");

  // Heuristic parsing based on presence/position of separators
  const hasComma = s.indexOf(",") !== -1;
  const hasDot = s.indexOf(".") !== -1;

  if (hasComma && !hasDot) {
    // likely comma is decimal separator (e.g., fr-FR)
    s = s.replace(/,/g, ".");
  } else if (hasComma && hasDot) {
    // both present — decide by last occurrence: the rightmost is decimal
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // comma is decimal, dot is thousands
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // dot is decimal, comma is thousands
      s = s.replace(/,/g, "");
    }
  } else {
    // only digits / maybe minus
    // nothing to do
  }

  // remove any remaining characters that are not digits, minus or dot
  s = s.replace(/[^0-9.-]/g, "");

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
