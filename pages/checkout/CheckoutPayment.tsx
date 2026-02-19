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

    const { country, countryId, service, serviceId, price, amountNGN } = checkoutState;

    // Ensure valid numerical values for price and amount
    const safePrice = Number(price) || 0;
    const safeAmountNGN = Number(amountNGN) || 0;
    const finalAmountNGN = safeAmountNGN > 0 ? safeAmountNGN : 0;

    // Compare in kobo: convert finalAmountNGN (naira) to kobo for comparison
    const hasSufficientFunds = wallet && (wallet.balance_kobo ?? 0) >= nairaToKobo(finalAmountNGN);

    const handleWalletPayment = async () => {
        if (!user || !wallet) return;

        setLoading(true);
        setError(null);

        try {
            console.log('Initiating Wallet Purchase:', { service, country, finalAmountNGN });

            // Get current session token for user identification
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Not authenticated. Please log in again.');
            }

            console.log('[CheckoutPayment] Session found, invoking smspool-service...');

            // Use anon key for Edge Function relay auth (same pattern as other pages)
            // Pass user token in body for the function to verify internally
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smspool-service`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s client timeout

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    action: 'purchase_wallet',
                    service_type: service,
                    service_id: serviceId,
                    country: country,
                    country_id: countryId,
                    user_token: session.access_token
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                console.error('[CheckoutPayment] Server error response:', JSON.stringify(data));
                throw new Error(data.message || data.error || `Server error: ${response.status}`);
            }


            if (!data.success) {
                // Handle specific error messages if needed
                throw new Error(data.message || 'Purchase failed');
            }

            console.log('Purchase Successful:', data);

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
            } else if (err.message?.includes('Insufficient funds')) {
                setError('Insufficient funds. Please top up your wallet.');
            } else {
                setError(err.message || 'Failed to process wallet payment.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 flex flex-col h-full overflow-y-auto w-full">
            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-12">
                <div className="flex flex-col items-center relative z-10 cursor-pointer" onClick={() => navigate('/checkout/summary')}>
                    <div className="size-8 md:size-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-md ring-4 ring-white dark:ring-[#221c10]">
                        <span className="material-symbols-outlined text-lg">check</span>
                    </div>
                    <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-500 whitespace-nowrap">Summary</span>
                </div>
                <div className="w-16 md:w-32 h-1 bg-emerald-500 rounded-full mx-2 md:mx-4"></div>
                <div className="flex flex-col items-center relative z-10">
                    <div className="size-10 md:size-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-xl shadow-primary/30 ring-4 ring-white dark:ring-[#221c10]">
                        2
                    </div>
                    <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-primary whitespace-nowrap">Payment</span>
                </div>
                <div className="w-16 md:w-32 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mx-2 md:mx-4 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20"></div>
                </div>
                <div className="flex flex-col items-center relative z-10 opacity-50">
                    <div className="size-8 md:size-10 rounded-full bg-slate-100 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-sm md:text-base ring-4 ring-white dark:ring-[#221c10]">
                        3
                    </div>
                    <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-slate-400 whitespace-nowrap">Success</span>
                </div>
            </div>

            <div className="flex flex-col gap-8">
                <div className="text-center">
                    <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">Secure Checkout</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Deduct from your wallet balance.</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Order Details</h3>
                    </div>
                    <div className="p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm gap-4">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <ServiceLogo serviceName={service} size="lg" />
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{country} Number</p>
                                    <p className="text-sm text-slate-500">{service} Verification</p>
                                </div>
                            </div>
                            <div className="font-black text-xl text-slate-900 dark:text-white w-full sm:w-auto text-right sm:text-left border-t sm:border-t-0 border-slate-100 dark:border-zinc-800 pt-2 sm:pt-0">₦{finalAmountNGN?.toLocaleString()}</div>
                        </div>

                        {/* Wallet Status */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Method</label>
                            <div className={`flex items-center justify-between p-4 border rounded-xl transition-colors ${hasSufficientFunds ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg border shadow-sm ${hasSufficientFunds ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-red-100 border-red-200 text-red-600'}`}>
                                        <span className="material-symbols-outlined">account_balance_wallet</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Wallet Balance</p>
                                        <p className={`text-xs font-medium ${hasSufficientFunds ? 'text-emerald-600' : 'text-red-600'}`}>
                                            Available: {formatNaira(wallet?.balance_kobo ?? 0)}
                                        </p>
                                    </div>
                                </div>
                                {hasSufficientFunds && (
                                    <div className="size-6 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                                        <div className="size-3 rounded-full bg-emerald-500"></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                                <span className="material-symbols-outlined text-red-500">error</span>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-red-900 dark:text-red-200">Transaction Failed</p>
                                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-dashed border-slate-200 dark:border-zinc-700 pt-6 flex justify-between items-center">
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">Total Due</span>
                            <span className="text-3xl font-black text-primary">₦{finalAmountNGN?.toLocaleString()}</span>
                        </div>

                        <button
                            onClick={handleWalletPayment}
                            disabled={loading || !hasSufficientFunds}
                            className={`w-full font-black py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2 transition-all active:scale-[0.98] 
                                ${loading || !hasSufficientFunds
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500 shadow-none'
                                    : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'}`}
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">refresh</span>
                                    Processing...
                                </>
                            ) : !hasSufficientFunds ? (
                                <>
                                    <span className="material-symbols-outlined">block</span>
                                    Insufficient Funds
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">payments</span>
                                    Pay ₦{finalAmountNGN?.toLocaleString()} Now
                                </>
                            )}
                        </button>
                        {!hasSufficientFunds && (
                            <p className="text-center text-xs text-red-500">Please contact support to top up your wallet.</p>
                        )}
                        <p className="text-center text-xs text-slate-400">By confirming, you agree to our Terms of Service.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPayment;