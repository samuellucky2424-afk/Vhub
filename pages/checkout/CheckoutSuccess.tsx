import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../src/lib/supabase';
import { useApp } from '../../App';

const CheckoutSuccess: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshNumbers } = useApp();
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Get reference and number from navigation state
    const reference = location.state?.reference;
    const navNumber = location.state?.number;

    useEffect(() => {
        // If number was already provided (wallet purchase), skip polling
        if (navNumber) {
            setPhoneNumber(String(navNumber));
            setLoading(false);
            refreshNumbers();
            return;
        }

        if (!reference) {
            setLoading(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 30;

        const fetchOrder = async () => {
            try {
                // Try fetching by id first (wallet purchases), then by payment_reference for historical gateway records
                let order = null;
                let fetchError = null;

                const { data: byId, error: idErr } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', reference)
                    .maybeSingle();

                if (byId) {
                    order = byId;
                } else {
                    const { data: byRef, error: refErr } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('payment_reference', reference)
                        .maybeSingle();
                    order = byRef;
                    fetchError = refErr;
                }

                if (!order) {
                    if (fetchError) throw fetchError;
                    // Order not found yet, keep polling
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(fetchOrder, 2000);
                    } else {
                        setError('Timeout waiting for number provisioning. Please check "My Numbers".');
                        setLoading(false);
                    }
                    return;
                }

                // Check Verifications table for this order
                const { data: verification } = await supabase
                    .from('verifications')
                    .select('otp_code')
                    .eq('order_id', order.id)
                    .maybeSingle();

                if (verification && verification.otp_code && verification.otp_code !== 'PENDING') {
                    setPhoneNumber(order.metadata?.phonenumber || order.metadata?.number);
                    setLoading(false);
                    refreshNumbers();
                    return;
                }

                if (order?.metadata?.phonenumber || order?.metadata?.number) {
                    setPhoneNumber(order.metadata.phonenumber || String(order.metadata.number));
                    setLoading(false);
                    refreshNumbers();
                } else if (order?.payment_status === 'failed') {
                    setError(order.metadata?.payment_error || 'Payment verification failed');
                    setLoading(false);
                } else {
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(fetchOrder, 2000);
                    } else {
                        setError('Timeout waiting for number provisioning. Please check "My Numbers".');
                        setLoading(false);
                    }
                }
            } catch (err) {
                console.error('Error fetching order:', err);
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(fetchOrder, 2000);
                } else {
                    setLoading(false);
                }
            }
        };

        fetchOrder();

        return () => {
            attempts = maxAttempts;
        };
    }, [reference, navNumber]);

    return (
        <div className="max-w-2xl mx-auto px-3 py-4 md:py-8 flex flex-col h-full overflow-y-auto w-full items-center justify-center">
            {/* Compact Step Indicator */}
            <div className="flex items-center justify-center mb-8 md:mb-12 scale-90 md:scale-100 w-full">
                <div className="flex flex-col items-center relative z-10 cursor-pointer" onClick={() => navigate('/checkout/summary')}>
                    <div className="size-7 md:size-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-base shadow-md ring-2 ring-white dark:ring-[#221c10]">
                        <span className="material-symbols-outlined text-sm md:text-base">check</span>
                    </div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-emerald-600 dark:text-emerald-500 whitespace-nowrap">Configure</span>
                </div>
                <div className="w-12 md:w-24 h-0.5 bg-emerald-500 mx-2"></div>
                <div className="flex flex-col items-center relative z-10 cursor-pointer" onClick={() => navigate('/checkout/payment')}>
                    <div className="size-7 md:size-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-base shadow-md ring-2 ring-white dark:ring-[#221c10]">
                        <span className="material-symbols-outlined text-sm md:text-base">check</span>
                    </div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-emerald-600 dark:text-emerald-500 whitespace-nowrap">Payment</span>
                </div>
                <div className="w-12 md:w-24 h-0.5 bg-emerald-500 mx-2"></div>
                <div className="flex flex-col items-center relative z-10">
                    <div className="size-8 md:size-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-lg shadow-primary/30 ring-2 ring-white dark:ring-[#221c10]">
                        3
                    </div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-primary whitespace-nowrap">Success</span>
                </div>
            </div>

            <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm p-6 md:p-10 text-center">
                <div className="mb-6 flex justify-center">
                    <div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <span className="material-symbols-outlined text-4xl">check_circle</span>
                    </div>
                </div>
                <h1 className="text-2xl font-black mb-2 tracking-tight text-slate-900 dark:text-white">Order Confirmed!</h1>

                {loading ? (
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-sm">refresh</span>
                        Provisioning your number...
                    </p>
                ) : error ? (
                    <p className="text-red-500 text-sm mb-8">{error}</p>
                ) : (
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Your virtual number is ready for use.</p>
                )}

                <div className="bg-slate-50 dark:bg-black/20 border-2 border-dashed border-primary/20 rounded-xl p-6 mb-8">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Allocated Number</div>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl md:text-3xl font-mono font-bold tracking-tight text-primary">
                            {loading ? "Allocating..." : phoneNumber || "Check History"}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={() => navigate('/numbers')}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm"
                    >
                        View Active Numbers
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                    <button
                        onClick={() => navigate('/checkout/summary')}
                        className="flex-1 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 font-bold py-3 px-6 rounded-lg transition-all text-sm text-slate-600 dark:text-slate-300"
                    >
                        Purchase Another
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutSuccess;
