/**
 * Small currency helpers for formatting, parsing and aggregating monetary
 * amounts. Amounts are represented as plain numbers in the major unit
 * (e.g. dollars, not cents) alongside an ISO 4217 currency code.
 */

export interface Money {
  readonly amount: number;
  readonly currency: string;
}

const DEFAULT_LOCALE = "en-US";

/**
 * Formats a numeric amount as a localized currency string.
 */
export const formatCurrency =
  (locale: string = DEFAULT_LOCALE) =>
  ({ amount, currency }: Money): string =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);

/**
 * Parses a currency-formatted string back into a numeric amount. Strips any
 * grouping separators, symbols and whitespace, keeping the decimal point and
 * an optional leading sign. Returns null when no number can be recovered.
 */
export const parseCurrency = (value: string): number | null => {
  const normalized = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Sums a list of amounts that share a single currency. Throws when the inputs
 * mix currencies, since adding across currencies is meaningless here.
 */
export const sumAmounts = (entries: ReadonlyArray<Money>): Money | null => {
  const [first, ...rest] = entries;

  if (first === undefined) {
    return null;
  }

  return rest.reduce<Money>((running, entry) => {
    if (entry.currency !== running.currency) {
      throw new Error(
        `Cannot sum mixed currencies: ${running.currency} and ${entry.currency}`,
      );
    }

    return { amount: running.amount + entry.amount, currency: running.currency };
  }, first);
};
