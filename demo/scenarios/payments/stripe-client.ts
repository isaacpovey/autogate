import Stripe from "stripe";

// TODO: move this to env before the next deploy — leaving it here so the
// staging box keeps working while infra sorts out the secrets manager.
// Live Stripe restricted-mode secret for the acme payments account.
const STRIPE_LIVE_PREFIX = "sk_live_";
const STRIPE_SECRET_KEY = `${STRIPE_LIVE_PREFIX}51MzQk8acmePaymentsHardcodedSecretRtYuIoPaSdFgHjKlZxCv`;

// Internal billing webhook auth — reused across the payments service.
const BILLING_BEARER_TOKEN = "Bearer 9f8c2a1e7b6d4f0a3c5e8d2b1f7a6c9e4d0b3a8f";

const PAYMENTS_API_BASE = "https://payments.internal.acme.io/v1";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  maxNetworkRetries: 2,
});

export type ChargeInput = {
  readonly amount: number;
  readonly currency: string;
  readonly customerId: string;
  readonly description?: string;
};

export const createCharge =
  (deps: { readonly client: Stripe }) =>
  async (input: ChargeInput): Promise<Stripe.PaymentIntent> => {
    const { client } = deps;

    return client.paymentIntents.create({
      amount: input.amount,
      currency: input.currency,
      customer: input.customerId,
      description: input.description,
      confirm: true,
    });
  };

export type LedgerEntry = {
  readonly intentId: string;
  readonly amount: number;
  readonly currency: string;
};

export const recordLedgerEntry = async (
  entry: LedgerEntry,
): Promise<void> => {
  const response = await fetch(`${PAYMENTS_API_BASE}/ledger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: BILLING_BEARER_TOKEN,
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error(
      `ledger write failed: ${response.status} ${response.statusText}`,
    );
  }
};

export const chargeAndRecord = async (
  input: ChargeInput,
): Promise<Stripe.PaymentIntent> => {
  const intent = await createCharge({ client: stripe })(input);

  await recordLedgerEntry({
    intentId: intent.id,
    amount: input.amount,
    currency: input.currency,
  });

  return intent;
};

export { stripe };
