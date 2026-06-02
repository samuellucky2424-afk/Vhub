import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../App';
import { supabase } from '../../src/lib/supabase';
import { ServiceLogo } from '../../src/utils/serviceIcons';
import { formatNaira, nairaToKobo, koboToNaira } from '../../src/utils/formatCurrency';


const CheckoutPayment: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, wallet, fetchWallet } = useApp();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize state from location or localStorage
    const [checkoutState, setCheckoutState] = useState(() => {
        if (location.state) {
            localStorage.setItem('pending_checkout_params', JSON.stringify(location.state));
            return location.state;
        }
        const saved = localStorage.getItem('pending_checkout_params');
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (!checkoutState) {
            navigate('/checkout/summary');
        }
        // Fetch wallet balance on mount
        fetchWallet();
    }, [checkoutState, navigate]);

    if (!checkoutState) {
        return null;
    }

    const { provider, country, countryId, service, serviceId, price, amountNGN } = checkoutState;

    // Ensure valid numerical values for price and amount
    const safePrice = Number(price) || 0;
    const safeAmountNGN = Number(amountNGN) || 0;
    const finalAmountNGN = safeAmountNGN > 0 ? safeAmountNGN : 0;

    // Compare in kobo: convert finalAmountNGN (naira) to kobo for comparison
    const hasSufficientFunds = wallet && (wallet.balance_kobo ?? 0) >= nairaToKobo(finalAmountNGN);

    const readFunctionErrorMessage = async (error: any, response?: Response) => {
        if (error?.name === 'FunctionsFetchError' && error?.context?.name === 'AbortError') {
            const timeoutError = new Error('Request timed out');
            timeoutError.name = 'AbortError';
            throw timeoutError;
        }

        if (error?.name === 'FunctionsFetchError') {
            throw new Error('Failed to fetch');
        }

        const rawResponse = response ? await response.text() : '';
        let parsed: any = null;

        if (rawResponse) {
            try {
                parsed = JSON.parse(rawResponse);
            } catch {
                parsed = { message: rawResponse };
            }
        }

        console.error('[CheckoutPayment] Server error response:', rawResponse || error);
        throw new Error(parsed?.message || parsed?.error || rawResponse || error?.message || 'Request failed');
    };

    const handleWalletPayment = async () => {
        if (!user || !wallet) return;

        setLoading(true);
        setError(null);

        try {
            console.log('Initiating Wallet Purchase:', { service, country, finalAmountNGN });

            console.log('[CheckoutPayment] Authenticated user found, invoking textverify-service...');

            // Get current session for token
            const { data: { session } } = await supabase.auth.getSession();
            const userToken = session?.access_token;
            if (!userToken) {
                throw new Error('User not authenticated');
            }

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/textverify-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    action: 'purchase_wallet',
                    provider: provider || 'sms_pool',
                    service_type: service,
                    service_id: serviceId,
                    country: countryId || country,
                    country_id: countryId,
                    user_token: userToken // Pass token manually to bypass gateway ES256 issue
                })
            });

            const rawText = await response.text();
            let data: any = null;
            try {
                data = JSON.parse(rawText);
            } catch {
                throw new Error(`Server error (${response.status}): ${rawText}`);
            }

            if (!response.ok) {
                console.error('[CheckoutPayment] Server error response:', rawText);
                throw new Error(data?.message || data?.error || `Request failed with status ${response.status}`);
            }

            if (!data.success) {
                throw new Error(data.message || 'Purchase failed');
            }

            console.log('Purchase Successful:', data);

            // Start countdown timer for auto-cancel (non-blocking, fire and forget)
            (async () => {
                try {
                    console.log('[CheckoutPayment] Starting countdown for order:', data.order_id);

                    const countdownResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/countdown`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        },
                        body: JSON.stringify({
                            action: 'start_countdown',
                            order_id: data.order_id,
                            smspool_order_id: data.smspool_order_id || data.order_id,
                            user_token: userToken
                        })
                    });

                    if (!countdownResponse.ok) {
                        const rawCountdownError = await countdownResponse.text();
                        console.log('[CheckoutPayment] Countdown request background error:', rawCountdownError);
                        return;
                    }

                    console.log('[CheckoutPayment] Countdown started successfully');
                } catch (countdownErr) {
                    console.log('[CheckoutPayment] Countdown request sent (may be running in background)');
                }
            })(); // Immediately invoked, non-blocking

            // Refresh wallet to show new balance
            await fetchWallet();

            // Clear checkout state
            localStorage.removeItem('pending_checkout_params');

            // Navigate to success
            navigate('/checkout/success', {
                state: {
                    service,
                    price,
                    reference: data.order_id,
                    number: data.number
                }
            });

        } catch (err: any) {
            console.error('Wallet Purchase Error:', err);
            if (err.name === 'AbortError') {
                setError('Request timed out. Your wallet was NOT charged. Please try again.');
            } else if (err.message === 'Failed to fetch') {
                setError('Unable to reach the purchase service. Please refresh and try again.');
            } else if (err.message?.includes('Insufficient funds')) {
                setError('Insufficient funds. Please top up your wallet.');
            } else if (err.message?.match(/(Pool|SMSPool|Provider error|No numbers available|Wallet service error)/i)) {
                setError('An error occurred while processing your purchase. Our customer care team has been notified.');
            } else {
                setError(err.message || 'Failed to process wallet payment.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-3 py-4 md:py-8 flex flex-col h-full overflow-y-auto w-full">
            {/* Compact Step Indicator */}
            <div className="flex items-center justify-center mb-8 md:mb-12 scale-90 md:scale-100">
                <div className="flex flex-col items-center relative z-10 cursor-pointer" onClick={() => navigate('/checkout/summary')}>
                    <div className="size-7 md:size-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-base shadow-md ring-2 ring-white dark:ring-[#221c10]">
                        <span className="material-symbols-outlined text-sm md:text-base">check</span>
                    </div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-emerald-600 dark:text-emerald-500 whitespace-nowrap">Configure</span>
                </div>
                <div className="w-12 md:w-24 h-0.5 bg-emerald-500 mx-2"></div>
                <div className="flex flex-col items-center relative z-10">
                    <div className="size-8 md:size-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-lg shadow-primary/30 ring-2 ring-white dark:ring-[#221c10]">
                        2
                    </div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-primary whitespace-nowrap">Payment</span>
                </div>
                <div className="w-12 md:w-24 h-0.5 bg-slate-100 dark:bg-zinc-800 mx-2 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20"></div>
                </div>
                <div className="flex flex-col items-center relative z-10 opacity-50">
                    <div className="size-7 md:size-9 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-xs md:text-sm ring-2 ring-white dark:ring-[#221c10]">
                        3
                    </div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-slate-400 whitespace-nowrap">Success</span>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <div className="text-center">
                    <h1 className="text-2xl md:text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">Secure Payment</h1>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">Pay using your wallet balance.</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 md:p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">Order Details</h3>
                    </div>
                    <div className="p-4 md:p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm gap-3">
                            <div className="flex items-center gap-3">
                                <ServiceLogo serviceName={service} size="md" />
                                <div>
                                    <p className="font-bold text-xs md:text-sm text-slate-900 dark:text-white">{country} Number</p>
                                    <p className="text-[10px] md:text-xs text-slate-500">{service} Verification</p>
                                </div>
                            </div>
                            <div className="font-black text-sm md:text-lg text-slate-900 dark:text-white">₦{finalAmountNGN?.toLocaleString()}</div>
                        </div>

                        {/* Wallet Status */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Method</label>
                            <div className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${hasSufficientFunds ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-1 rounded-lg border shadow-sm ${hasSufficientFunds ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-red-100 border-red-200 text-red-600'}`}>
                                        <span className="material-symbols-outlined text-sm md:text-base">account_balance_wallet</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">Wallet Balance</p>
                                        <p className={`text-[10px] font-medium ${hasSufficientFunds ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {formatNaira(wallet?.balance_kobo ?? 0)}
                                        </p>
                                    </div>
                                </div>
                                {hasSufficientFunds && (
                                    <div className="size-5 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                                        <div className="size-2.5 rounded-full bg-emerald-500"></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                                <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-red-900 dark:text-red-200">Transaction Failed</p>
                                    <p className="text-[10px] text-red-700 dark:text-red-300 mt-0.5">{error}</p>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-dashed border-slate-200 dark:border-zinc-700 pt-4 flex justify-between items-center">
                            <span className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-300">Total Due</span>
                            <span className="text-xl md:text-2xl font-black text-primary">₦{finalAmountNGN?.toLocaleString()}</span>
                        </div>

                        <button
                            onClick={handleWalletPayment}
                            disabled={loading || !hasSufficientFunds}
                            className={`w-full font-bold py-3 md:py-3.5 rounded-lg shadow-lg flex items-center justify-center gap-2 mt-2 transition-all active:scale-[0.98] text-sm md:text-base
                                ${loading || !hasSufficientFunds
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500 shadow-none'
                                    : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'}`}
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined text-sm md:text-base animate-spin">refresh</span>
                                    Processing...
                                </>
                            ) : !hasSufficientFunds ? (
                                <>
                                    <span className="material-symbols-outlined text-sm md:text-base">block</span>
                                    Insufficient Funds
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-sm md:text-base">payments</span>
                                    Pay ₦{finalAmountNGN?.toLocaleString()}
                                </>
                            )}
                        </button>
                        {!hasSufficientFunds && (
                            <p className="text-center text-[10px] text-red-500">Please contact support to top up your wallet.</p>
                        )}
                        <p className="text-center text-[10px] text-slate-400">Secure 256-bit SSL Encryption</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPayment;
