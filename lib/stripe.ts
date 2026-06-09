import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-04-17" } as any) : null;

export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
