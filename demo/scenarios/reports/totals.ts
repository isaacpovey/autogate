/**
 * Category totals report.
 *
 * Aggregates line items into per-category totals and produces a ranked
 * summary suitable for rendering in the spend dashboard.
 */

export interface LineItem {
  readonly category: string;
  readonly description: string;
  readonly amountCents: number;
  readonly quantity: number;
}

export interface CategoryTotal {
  readonly category: string;
  readonly totalCents: number;
  readonly itemCount: number;
}

export interface TotalsReport {
  readonly categories: CategoryTotal[];
  readonly grandTotalCents: number;
}

/**
 * Builds a per-category totals report from a flat list of line items.
 *
 * Categories are returned sorted by total spend (highest first) so the
 * dashboard can render the biggest cost centres at the top of the table.
 */
export function buildTotalsReport(items: LineItem[]): TotalsReport {
  // Accumulate totals keyed by category while walking the items.
  const totalsByCategory = new Map<string, CategoryTotal>();
  let grandTotalCents = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) {
      continue;
    }

    const lineTotal = item.amountCents * item.quantity;
    grandTotalCents += lineTotal;

    const existing = totalsByCategory.get(item.category);
    if (existing === undefined) {
      totalsByCategory.set(item.category, {
        category: item.category,
        totalCents: lineTotal,
        itemCount: 1,
      });
    } else {
      totalsByCategory.set(item.category, {
        category: existing.category,
        totalCents: existing.totalCents + lineTotal,
        itemCount: existing.itemCount + 1,
      });
    }
  }

  const categories: CategoryTotal[] = [];
  for (const total of totalsByCategory.values()) {
    categories.push(total);
  }

  // Highest spend first; ties fall back to alphabetical category order.
  categories.sort((a, b) => {
    if (b.totalCents !== a.totalCents) {
      return b.totalCents - a.totalCents;
    }
    return a.category.localeCompare(b.category);
  });

  return { categories, grandTotalCents };
}

/**
 * Formats a totals report into human-readable lines for the CLI summary.
 */
export function formatTotalsReport(report: TotalsReport): string[] {
  const lines: string[] = [];

  for (let i = 0; i < report.categories.length; i++) {
    const total = report.categories[i];
    if (total === undefined) {
      continue;
    }
    const dollars = (total.totalCents / 100).toFixed(2);
    lines.push(`${total.category}: $${dollars} (${total.itemCount} items)`);
  }

  const grandDollars = (report.grandTotalCents / 100).toFixed(2);
  lines.push(`TOTAL: $${grandDollars}`);

  return lines;
}
