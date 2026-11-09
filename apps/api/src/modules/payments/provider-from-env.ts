import type { AppEnv } from "../../config/env.js";
import type { PaymentProvider } from "./provider.js";
import {
  SandboxPaymentProvider,
  UnconfiguredPaymentProvider,
} from "./sandbox-provider.js";

export function paymentProviderFromEnv(env: AppEnv): PaymentProvider {
  if (env.PAYMENT_PROVIDER === "unconfigured") {
    return new UnconfiguredPaymentProvider();
  }
  const keyId = env.PAYMENT_SANDBOX_KEY_ID;
  const keySecret = env.PAYMENT_SANDBOX_KEY_SECRET;
  const webhookSecret = env.PAYMENT_SANDBOX_WEBHOOK_SECRET;
  if (
    keyId === undefined ||
    keySecret === undefined ||
    webhookSecret === undefined
  ) {
    throw new Error("Invalid environment: PAYMENT_SANDBOX_KEY_ID");
  }
  return new SandboxPaymentProvider({ keyId, keySecret, webhookSecret });
}
