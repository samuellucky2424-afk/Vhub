<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1dr3X28DAuoIKCMLiGxTFsAiOWw-EIa_W

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase, provider, and Flutterwave credentials.
3. Configure Flutterwave:
   - Set `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY`, and `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
   - Set `FLUTTERWAVE_REDIRECT_URL` to your deployed wallet callback route, for example `https://your-app.example/#/wallet/success`
   - Point your Flutterwave dashboard webhook to `/functions/v1/flutterwave-webhook`
4. Run the app:
   `npm run dev`

## Payments

- Wallet funding now uses Flutterwave hosted checkout instead of Paystack.
- Supported funding methods: `card`, `bank transfer`, and `mobile money`.
- Wallet credits are finalized only after server-side verification through the Flutterwave webhook or callback verification endpoint.
- Historical wallet transactions remain compatible because the app still resolves balances using the stored `reference` field.

## Verification Flow

- Frontend initializes a hosted checkout session through `initialize-wallet-funding`.
- Flutterwave redirects back to `/#/wallet/success` with `tx_ref`, `transaction_id`, and `status`.
- The success page polls `wallet_transactions` and calls `verify-wallet-funding` if webhook settlement is delayed.
- The `flutterwave-webhook` function validates the `flutterwave-signature` header using your webhook secret hash, re-verifies the transaction, and credits the wallet idempotently.
