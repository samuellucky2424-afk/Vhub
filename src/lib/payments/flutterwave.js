/**
 * Shared Flutterwave helpers used by the frontend and Supabase edge functions.
 * Keep this module runtime-agnostic so it can be imported by both Vite and Deno.
 */

export const FLUTTERWAVE_PAYMENT_METHODS = {
    auto: 'auto',
    card: 'card',
    bank_transfer: 'bank_transfer',
    mobile_money: 'mobile_money',
};

export const MINIMUM_WALLET_FUNDING_NGN = 4500;

const MOBILE_MONEY_OPTIONS = [
    'mobilemoneyghana',
    'mobilemoneyfranco',
    'mobilemoneyuganda',
    'mobilemoneyrwanda',
    'mpesa',
];

export function mapFlutterwavePaymentMethodToOptions(method = FLUTTERWAVE_PAYMENT_METHODS.auto) {
    switch (method) {
        case FLUTTERWAVE_PAYMENT_METHODS.card:
            return 'card';
        case FLUTTERWAVE_PAYMENT_METHODS.bank_transfer:
            return 'banktransfer';
        case FLUTTERWAVE_PAYMENT_METHODS.mobile_money:
            return MOBILE_MONEY_OPTIONS.join(',');
        case FLUTTERWAVE_PAYMENT_METHODS.auto:
        default:
            return ['card', 'banktransfer', ...MOBILE_MONEY_OPTIONS].join(',');
    }
}

export function buildFlutterwaveFundingPayload({
    amount,
    redirectUrl,
    paymentMethod = FLUTTERWAVE_PAYMENT_METHODS.auto,
    reference,
    user,
}) {
    return {
        tx_ref: reference,
        amount: Number(amount),
        currency: 'NGN',
        redirect_url: redirectUrl,
        payment_options: mapFlutterwavePaymentMethodToOptions(paymentMethod),
        customer: {
            email: user.email,
            name: user.name || user.email,
        },
        customizations: {
            title: 'Vhub Wallet Funding',
            description: 'Top up your wallet with Flutterwave',
        },
        meta: {
            type: 'wallet_funding',
            user_id: user.id,
            payment_method: paymentMethod,
        },
    };
}

export function normalizeFlutterwaveStatus(status) {
    return String(status || '').trim().toLowerCase();
}

export function isFlutterwavePaymentSuccessful(status) {
    return ['successful', 'completed'].includes(normalizeFlutterwaveStatus(status));
}

export function getFlutterwaveErrorMessage(responseBody, statusCode = 500) {
    const topLevelMessage =
        responseBody?.message ||
        responseBody?.error ||
        responseBody?.data?.message ||
        responseBody?.data?.processor_response ||
        responseBody?.data?.status ||
        'Flutterwave request failed';

    const message = String(topLevelMessage).trim();
    const normalized = message.toLowerCase();

    if (statusCode === 401 || statusCode === 403) {
        return 'Flutterwave authentication failed. Check your API keys and webhook secret.';
    }

    if (normalized.includes('amount') && normalized.includes('minimum')) {
        return 'The transaction amount is below Flutterwave\'s allowed minimum.';
    }

    if (normalized.includes('invalid amount')) {
        return 'Flutterwave rejected the transaction amount.';
    }

    if (normalized.includes('insufficient funds')) {
        return 'The payment source has insufficient funds.';
    }

    if (normalized.includes('merchant') && normalized.includes('inactive')) {
        return 'Flutterwave rejected this request because the merchant account is inactive. Use active test keys or activate the live Flutterwave account.';
    }

    if (normalized.includes('duplicate')) {
        return 'This payment reference has already been used.';
    }

    if (normalized.includes('cancel')) {
        return 'The payment was cancelled before completion.';
    }

    if (normalized.includes('timeout')) {
        return 'Flutterwave did not confirm the transaction in time.';
    }

    if (normalized.includes('pending')) {
        return 'The payment is pending confirmation from Flutterwave.';
    }

    if (normalized.includes('expired')) {
        return 'The Flutterwave payment session expired before completion.';
    }

    return message || 'Flutterwave request failed';
}

export function extractFlutterwaveRedirectParams(search) {
    const params = new URLSearchParams(String(search || ''));

    return {
        status: params.get('status') || '',
        tx_ref: params.get('tx_ref') || params.get('txRef') || params.get('reference') || params.get('trxref') || '',
        transaction_id: params.get('transaction_id') || params.get('transactionId') || '',
    };
}
