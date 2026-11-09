import type { AppEnv } from "../../config/env.js";
import type { PaymentProvider } from "./provider.js";
import { RazorpayPaymentProvider } from "./razorpay-provider.js";
import {
  SandboxPaymentProvider,
  UnconfiguredPaymentProvider,
} from "./sandbox-provider.js";

export function paymentProviderFromEnv(env: AppEnv): PaymentProvider {
  if (env.PAYMENT_PROVIDER === "unconfigured") {
    return new UnconfiguredPaymentProvider();
  }
  if (env.PAYMENT_PROVIDER === "razorpay") {
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
    if (
      keyId === undefined ||
      keySecret === undefined ||
      webhookSecret === undefined
    ) {
      throw new Error("Invalid environment: RAZORPAY_KEY_ID");
    }
    return new RazorpayPaymentProvider({ keyId, keySecret, webhookSecret });
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
