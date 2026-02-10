import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../App';
import { supabase } from '../../src/lib/supabase';
import { usePaystackPayment } from 'react-paystack';

const CheckoutPayment: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useApp();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);

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
    }, [checkoutState, navigate]);

    if (!checkoutState) {
        return null; // Or loading spinner
    }

    const { country, countryId, service, serviceId, price, amountNGN } = checkoutState;

    console.log('[CheckoutPayment] Raw State:', {
        checkoutState,
        price,
        amountNGN,
        priceType: typeof price,
        amountNGNType: typeof amountNGN
    });

    // Ensure valid numerical values for price and amount
    const safePrice = Number(price) || 0;
    const safeAmountNGN = Number(amountNGN) || 0;

    // Calculate final amount in NGN
    // If we have a direct amountNGN from state, use it. Otherwise calculate from price.
    // Fallback scheme: State Price -> 0
    const calculatedAmountNGN = safeAmountNGN > 0
        ? safeAmountNGN
        : Math.ceil(safePrice * 1.9 * (Number(import.meta.env.VITE_USD_TO_NGN_RATE) || 1650));

    const finalAmountNGN = calculatedAmountNGN > 0 ? calculatedAmountNGN : 0;

    console.log('[CheckoutPayment] Amount Calculation:', {
        safePrice,
        safeAmountNGN,
        calculatedAmountNGN,
        finalAmountNGN,
        usdToNgnRate: import.meta.env.VITE_USD_TO_NGN_RATE
    });

    const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

    // Validate minimum amount (Paystack requires minimum 100 NGN = 10,000 kobo)
    const MINIMUM_NGN = 100;
    const isAmountValid = finalAmountNGN >= MINIMUM_NGN;

    // Paystack configuration - Wrapped in useMemo to prevent re-initialization loops
    const config = React.useMemo(() => {
        // Ensure amount is a valid integer (kobo) and positive
        const amountKobo = Math.round(finalAmountNGN * 100);

        console.log('[CheckoutPayment] Config Generation:', {
            publicKeyLength: paystackPublicKey.length,
            finalAmountNGN,
            amountKobo,
            email: user?.email,
            orderId,
            isAmountValid
        });

        if (!paystackPublicKey) {
            console.error('[CheckoutPayment] Missing Paystack Public Key! Check .env variables.');
        }

        if (!isAmountValid) {
            console.error(`[CheckoutPayment] Amount too low! ₦${finalAmountNGN} is below minimum ₦${MINIMUM_NGN}`);
        }

        // Runtime validation check (though we handled it with disabled button, we log specific errors)
        if (amountKobo <= 0) console.error('[CheckoutPayment] Invalid amount:', amountKobo);
        if (!paystackPublicKey) console.error('[CheckoutPayment] Missing Public Key');

        const paystackConfig = {
            reference: orderId || `order_${Date.now()}`,
            email: user?.email || 'guest@virtualnumberhub.com',
            amount: amountKobo > 0 ? amountKobo : 10000,
            publicKey: paystackPublicKey,
            currency: 'NGN',
            channels: ['card', 'bank', 'ussd', 'bank_transfer'],
            metadata: {
                custom_fields: [
                    {
                        display_name: "Country",
                        variable_name: "country",
                        value: country
                    },
                    {
                        display_name: "Service",
                        variable_name: "service",
                        value: service
                    }
                ],
                referrer: window.location.href
            }
        };

        return paystackConfig;
    }, [orderId, user?.email, finalAmountNGN, paystackPublicKey, country, service, isAmountValid]);

    const initializePayment = usePaystackPayment(config);

    // Create order when component mounts
    useEffect(() => {
        const createOrder = async () => {
            if (!user) {
                // If we have saved state but no user, we wait for auth check in App.tsx
                // If after auth check we still have no user, App.tsx will redirect to login (if protected)
                // or we show error here.
                // For now, show error if not logged in.
                setError('You must be logged in to make a purchase');
                return;
            }

            // Always create a new order to ensure unique Paystack reference
            // const savedOrderId = localStorage.getItem('pending_checkout_order_id');
            // if (savedOrderId) {
            //     setOrderId(savedOrderId);
            //     return;
            // }

            setLoading(true);
            try {
                // Get current user session
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.user) {
                    setError('Authentication required. Please log in again.');
                    navigate('/login');
                    return;
                }

                console.log('Creating order for user:', session.user.id);
                console.log('Order data:', { service, price, country, countryId, serviceId });

                // Create order in database
                const { data: order, error: insertError } = await supabase
                    .from('orders')
                    .insert({
                        user_id: session.user.id,
                        service_type: service,
                        price_usd: price,
                        payment_status: 'pending',
                        payment_reference: `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        metadata: {
                            country,
                            countryId,
                            service,
                            serviceId,
                            price,
                            total_paid_ngn: finalAmountNGN
                        }
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Order creation error:', insertError);
                    console.error('Error code:', insertError.code);
                    console.error('Error message:', insertError.message);
                    console.error('Error details:', insertError.details);
                    console.error('Error hint:', insertError.hint);
                    setError(`Failed to create order: ${insertError.message || 'Please try again.'}`);
                    return;
                }

                if (order) {
                    setOrderId(order.payment_reference);
                    // localStorage.setItem('pending_checkout_order_id', order.payment_reference);
                    console.log('Order created successfully:', order.id);
                }
            } catch (err: any) {
                console.error('Unexpected error:', err);
                console.error('Error stack:', err.stack);
                setError(`An unexpected error occurred: ${err.message || 'Please try again.'}`);
            } finally {
                setLoading(false);
            }
        };

        createOrder();
    }, [user, country, countryId, service, serviceId, price, navigate]);

    const handlePayment = () => {
        if (!orderId) {
            setError('Order not initialized. Please refresh and try again.');
            return;
        }

        setLoading(true);
        setError(null);

        const onSuccess = (reference: any) => {
            console.log('Payment successful:', reference);

            // Clear checkout state
            localStorage.removeItem('pending_checkout_params');
            localStorage.removeItem('pending_checkout_order_id');

            // Navigate to success page
            navigate('/checkout/success', {
                state: {
                    service,
                    price,
                    reference: reference.reference
                }
            });
        };

        const onClose = () => {
            console.log('Payment modal closed');
            setLoading(false);
            setError('Payment was cancelled. Starting a new session...');

            // Clear current order to force a new reference generation on next attempt
            // This prevents "Duplicate Transaction Reference" errors from Paystack
            setOrderId(null);
            localStorage.removeItem('pending_checkout_order_id');

            // Optional: Trigger re-creation automatically or let user click again?
            // Since useEffect depends on orderId/user/etc, clearing orderId might trigger it?
            // Actually useEffect checks for *saved* order. If we clear saved, it creates new.
            // But we need to trigger the effect.
            // Dependency array: [user, country, ... navigate]
            // It doesn't depend on orderId (to avoid loops).
            // So we might need to manually trigger creation or just let the user refresh/click?
            // Better UX: Reload the page or navigate away and back? 
            // Simplest: Just clear it, and if the user clicks "Pay", 
            // handlePayment checks !orderId -> setError. 
            // But useEffect runs on mount. 
            // Let's force a reload of the component?

            // Actually, simply clearing it means the user sees "Initializing..." again if we trigger the effect.
            // But the effect has `if (savedOrderId) setOrderId; return;`
            // If we clear localStorage, and run createOrder...

            // Let's just reload the valid state to trigger creation:
            window.location.reload();
        };

        // Corrected invocation: pass as an object properties
        // @ts-ignore - types might be outdated but implementation supports object
        initializePayment({ onSuccess, onClose });
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 flex flex-col h-full overflow-y-auto w-full">
            {/* Responsive Step Indicator */}
            <div className="flex items-center justify-center mb-12">
                {/* Step 1 - Completed */}
                <div className="flex flex-col items-center relative z-10 cursor-pointer" onClick={() => navigate('/checkout/summary')}>
                    <div className="size-8 md:size-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-md ring-4 ring-white dark:ring-[#221c10]">
                        <span className="material-symbols-outlined text-lg">check</span>
                    </div>
                    <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-500 whitespace-nowrap">Summary</span>
                </div>

                {/* Connector - Full */}
                <div className="w-16 md:w-32 h-1 bg-emerald-500 rounded-full mx-2 md:mx-4"></div>

                {/* Step 2 - Active */}
                <div className="flex flex-col items-center relative z-10">
                    <div className="size-10 md:size-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-xl shadow-primary/30 ring-4 ring-white dark:ring-[#221c10]">
                        2
                    </div>
                    <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-primary whitespace-nowrap">Payment</span>
                </div>

                {/* Connector - Empty */}
                <div className="w-16 md:w-32 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mx-2 md:mx-4 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20"></div>
                </div>

                {/* Step 3 - Pending */}
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
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Review your order details and confirm payment.</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Order Details</h3>
                    </div>
                    <div className="p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-2xl">
                                        {service === 'WhatsApp' ? 'chat' : 'public'}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{country} Number</p>
                                    <p className="text-sm text-slate-500">{service} Verification</p>
                                </div>
                            </div>
                            <div className="font-black text-xl text-slate-900 dark:text-white">₦{finalAmountNGN?.toLocaleString()}</div>
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Method</label>
                            <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-800/50 cursor-pointer hover:border-primary transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white dark:bg-black p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm">
                                        <span className="material-symbols-outlined text-slate-700 dark:text-slate-200">credit_card</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Paystack</p>
                                        <p className="text-xs text-slate-500 font-medium">Card, Bank Transfer, USSD</p>
                                    </div>
                                </div>
                                <div className="size-6 rounded-full border-2 border-primary flex items-center justify-center">
                                    <div className="size-3 rounded-full bg-primary"></div>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                                <span className="material-symbols-outlined text-red-500">error</span>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-red-900 dark:text-red-200">Payment Error</p>
                                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Amount Validation Error */}
                        {!isAmountValid && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                                <span className="material-symbols-outlined text-amber-500">warning</span>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Invalid Amount</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                        The amount (₦{finalAmountNGN}) is below the minimum transaction amount of ₦{MINIMUM_NGN}.
                                        Please go back and select a different service or contact support.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-dashed border-slate-200 dark:border-zinc-700 pt-6 flex justify-between items-center">
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-300">Total Amount</span>
                            <span className="text-3xl font-black text-primary">₦{finalAmountNGN?.toLocaleString()}</span>
                        </div>

                        <button
                            onClick={handlePayment}
                            disabled={loading || !orderId || !!error || !isAmountValid}
                            className={`w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-2 transition-all active:scale-[0.98] ${loading || !orderId || !isAmountValid ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary/90'}`}
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">refresh</span>
                                    {orderId ? 'Processing...' : 'Initializing...'}
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">lock</span>
                                    Pay with Paystack
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs text-slate-400">By confirming, you agree to our Terms of Service.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPayment;