import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((_req: Request) => {
  console.warn("[paystack-webhook] Deprecated endpoint invoked after Flutterwave migration.");
  return new Response("OK", { status: 200 });
});
