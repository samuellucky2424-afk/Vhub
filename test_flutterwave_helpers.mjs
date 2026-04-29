import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FLUTTERWAVE_PAYMENT_METHODS,
    buildFlutterwaveFundingPayload,
    extractFlutterwaveRedirectParams,
    getFlutterwaveErrorMessage,
    isFlutterwavePaymentSuccessful,
    mapFlutterwavePaymentMethodToOptions,
    normalizeFlutterwaveStatus,
} from './src/lib/payments/flutterwave.js';

test('maps funding methods to Flutterwave payment options', () => {
    assert.equal(mapFlutterwavePaymentMethodToOptions(FLUTTERWAVE_PAYMENT_METHODS.card), 'card');
    assert.equal(mapFlutterwavePaymentMethodToOptions(FLUTTERWAVE_PAYMENT_METHODS.bank_transfer), 'banktransfer');
    assert.match(mapFlutterwavePaymentMethodToOptions(FLUTTERWAVE_PAYMENT_METHODS.mobile_money), /mpesa/);
    assert.match(mapFlutterwavePaymentMethodToOptions(FLUTTERWAVE_PAYMENT_METHODS.auto), /card/);
    assert.match(mapFlutterwavePaymentMethodToOptions(FLUTTERWAVE_PAYMENT_METHODS.auto), /banktransfer/);
});

test('builds a Flutterwave funding payload with wallet metadata', () => {
    const payload = buildFlutterwaveFundingPayload({
        amount: 2500,
        redirectUrl: 'http://localhost:5173/#/wallet/success',
        paymentMethod: FLUTTERWAVE_PAYMENT_METHODS.mobile_money,
        reference: 'fund_test_123',
        user: {
            id: 'user-1',
            email: 'demo@example.com',
            name: 'Demo User',
        },
    });

    assert.deepEqual(payload.customer, {
        email: 'demo@example.com',
        name: 'Demo User',
    });
    assert.equal(payload.tx_ref, 'fund_test_123');
    assert.equal(payload.meta.type, 'wallet_funding');
    assert.equal(payload.meta.user_id, 'user-1');
    assert.equal(payload.meta.payment_method, FLUTTERWAVE_PAYMENT_METHODS.mobile_money);
    assert.match(payload.payment_options, /mobilemoneyghana/);
});

test('extracts Flutterwave redirect parameters while staying backward compatible', () => {
    const flutterwave = extractFlutterwaveRedirectParams('status=successful&tx_ref=fund_123&transaction_id=456');
    assert.deepEqual(flutterwave, {
        status: 'successful',
        tx_ref: 'fund_123',
        transaction_id: '456',
    });

    const historical = extractFlutterwaveRedirectParams('reference=legacy_ref&trxref=legacy_ref_2');
    assert.equal(historical.tx_ref, 'legacy_ref');
    assert.equal(historical.transaction_id, '');
});

test('normalizes Flutterwave statuses and success detection', () => {
    assert.equal(normalizeFlutterwaveStatus(' Successful '), 'successful');
    assert.equal(isFlutterwavePaymentSuccessful('successful'), true);
    assert.equal(isFlutterwavePaymentSuccessful('completed'), true);
    assert.equal(isFlutterwavePaymentSuccessful('cancelled'), false);
});

test('surfaces Flutterwave-specific error messages', () => {
    assert.equal(
        getFlutterwaveErrorMessage({ message: 'Amount does not meet minimum amount allowed' }, 400),
        "The transaction amount is below Flutterwave's allowed minimum.",
    );
    assert.equal(
        getFlutterwaveErrorMessage({ message: 'Insufficient Funds' }, 400),
        'The payment source has insufficient funds.',
    );
    assert.equal(
        getFlutterwaveErrorMessage({ message: 'Unauthorized' }, 401),
        'Flutterwave authentication failed. Check your API keys and webhook secret.',
    );
});
