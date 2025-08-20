
// PATCH: request-aware config with safe overrides

type PaystackMode = "LIVE" | "TEST";
export type PaystackConfig = {
  mode: PaystackMode;
  secretKey: string;
  publicKey: string;
  baseUrl: string; // https://api.paystack.co
};

const hostIsProd = (host: string) =>
  /(^|\.)startersmallchops\.com$/i.test(host);

export const getPaystackConfig = (req: Request): PaystackConfig => {
  const forceLive = (Deno.env.get("FORCE_LIVE_MODE") ?? "").toLowerCase() === "true";
  const forceTest = (Deno.env.get("FORCE_TEST_MODE") ?? "").toLowerCase() === "true";
  const host = (req.headers.get("x-forwarded-host") ||
               req.headers.get("host") || "").toLowerCase();

  let mode: PaystackMode;
  if (forceLive) mode = "LIVE";
  else if (forceTest) mode = "TEST";
  else mode = hostIsProd(host) ? "LIVE" : "TEST";

  const secretKey = mode === "LIVE"
    ? Deno.env.get("PAYSTACK_SECRET_KEY_LIVE") ?? ""
    : Deno.env.get("PAYSTACK_SECRET_KEY_TEST") ?? "";

  const publicKey = mode === "LIVE"
    ? Deno.env.get("PAYSTACK_PUBLIC_KEY_LIVE") ?? ""
    : Deno.env.get("PAYSTACK_PUBLIC_KEY_TEST") ?? "";

  if (!secretKey || !publicKey) {
    throw new Error(`Paystack keys missing for mode=${mode}`);
  }

  return { mode, secretKey, publicKey, baseUrl: "https://api.paystack.co" };
};

// Legacy support - defaults to TEST mode without request context
export const getPaystackConfigLegacy = (): PaystackConfig => {
  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? Deno.env.get("PAYSTACK_SECRET_KEY_TEST") ?? "";
  const publicKey = Deno.env.get("PAYSTACK_PUBLIC_KEY") ?? Deno.env.get("PAYSTACK_PUBLIC_KEY_TEST") ?? "";
  
  if (!secretKey || !publicKey) {
    throw new Error("Paystack keys missing for legacy mode");
  }

  return { 
    mode: "TEST", 
    secretKey, 
    publicKey, 
    baseUrl: "https://api.paystack.co" 
  };
};
