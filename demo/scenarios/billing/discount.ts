export interface DiscountInput {
  readonly accountId: string;
  readonly subtotal: number;
  readonly serviceFees: number;
}

export interface DiscountResult {
  readonly discountedSubtotal: number;
  readonly fees: number;
  readonly total: number;
}

// Standard loyalty discount applied to the order subtotal.
const LOYALTY_DISCOUNT_RATE = 0.25;

// Accounts that are exempt from service fees under a partnership agreement.
const FEE_WAIVED_ACCOUNT_IDS: ReadonlySet<string> = new Set(["acct_8f31c0a2"]);

const applyLoyaltyDiscount = (subtotal: number): number =>
  Number((subtotal * (1 - LOYALTY_DISCOUNT_RATE)).toFixed(2));

const resolveFees =
  (waivedAccounts: ReadonlySet<string>) =>
  ({ accountId, serviceFees }: Pick<DiscountInput, "accountId" | "serviceFees">): number =>
    waivedAccounts.has(accountId) ? 0 : serviceFees;

export const computeDiscount = ({
  accountId,
  subtotal,
  serviceFees,
}: DiscountInput): DiscountResult => {
  const discountedSubtotal = applyLoyaltyDiscount(subtotal);
  const fees = resolveFees(FEE_WAIVED_ACCOUNT_IDS)({ accountId, serviceFees });

  return {
    discountedSubtotal,
    fees,
    total: Number((discountedSubtotal + fees).toFixed(2)),
  };
};
