import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../src/lib/supabase';

const CheckoutSuccess: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Get reference from navigation state
    const reference = location.state?.reference;

    useEffect(() => {
        if (!reference) {
            // If no reference, we can't fetch. Maybe just show success? 
            // Or redirect? For now, we'll stop loading.
            setLoading(false);
            return;
        }

        let attempts = 0;
        const maxAttempts = 30; // 30 attempts * 2s = 60s timeout

        const fetchOrder = async () => {
            try {
                const { data: order, error: fetchError } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('payment_reference', reference)
                    .single();

                if (fetchError) throw fetchError;

                if (order?.metadata?.phonenumber) {
                    setPhoneNumber(order.metadata.phonenumber);
                    setLoading(false);
                } else if (order?.payment_status === 'failed') {
                    setError(order.metadata?.payment_error || 'Payment verification failed');
                    setLoading(false);
                } else {
                    // Keep polling
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
                // Keep polling on network error? Or stop? 
                // Let's retry on error too for resilience
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
            // Cleanup if component unmounts (though standard fetch can't be easily cancelled without abortcontroller, 
            // this simple pattern is okay for this context)
            attempts = maxAttempts; // Stop polling
        };
    }, [reference]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 h-full">
            <div className="w-full max-w-[640px] mb-12">
                <div className="h-2 w-full bg-[#e6e2db] dark:bg-[#3d3321] rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-full rounded-full"></div>
                </div>
            </div>

            <div className="w-full max-w-[640px] bg-white dark:bg-[#2d2516] rounded-xl shadow-xl border border-[#e6e2db] dark:border-[#3d3321] p-8 md:p-12 text-center">
                <div className="mb-6 flex justify-center">
                    <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-5xl">check_circle</span>
                    </div>
                </div>
                <h1 className="text-3xl font-bold mb-2 tracking-tight">Payment Successful!</h1>

                {loading ? (
                    <p className="text-[#897b61] dark:text-[#c4b59b] text-base mb-10 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-sm">refresh</span>
                        Provisioning your number...
                    </p>
                ) : error ? (
                    <p className="text-red-500 text-base mb-10">{error}</p>
                ) : (
                    <p className="text-[#897b61] dark:text-[#c4b59b] text-base mb-10">Your virtual number has been provisioned and is ready for use.</p>
                )}

                <div className="bg-background-light dark:bg-background-dark/50 border-2 border-dashed border-primary/30 rounded-xl p-6 mb-10 relative group">
                    <div className="text-sm uppercase tracking-widest text-[#897b61] dark:text-[#c4b59b] font-bold mb-3">Your New Number</div>
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-[#181511] dark:text-white">
                            {loading ? "Allocating..." : phoneNumber || "Check 'My Numbers'"}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => navigate('/numbers')}
                        className="flex-1 bg-primary hover:bg-primary/90 text-[#181511] font-bold py-4 px-8 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        Go to My Numbers
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                    <button
                        onClick={() => navigate('/checkout/summary')}
                        className="flex-1 border-2 border-[#e6e2db] dark:border-[#3d3321] hover:bg-background-light dark:hover:bg-[#3d3321] font-bold py-4 px-8 rounded-lg transition-all"
                    >
                        Purchase Another
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutSuccess;
