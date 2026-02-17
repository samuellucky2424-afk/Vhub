import React, { useState } from 'react';
import PaystackPop from '@paystack/inline-js';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

const PaystackFunding: React.FC = () => {
    const { user, fetchWallet } = useApp();
    const [amount, setAmount] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Paystack Config
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';
    const userEmail = user?.email || 'customer@example.com';

    const handleFundWallet = () => {
        const amountNGN = Number(amount) || 0;

        if (amountNGN < 100) {
            setMessage({ type: 'error', text: 'Minimum amount is ₦100' });
            return;
        }

        if (!publicKey) {
            setMessage({ type: 'error', text: 'Paystack Public Key is missing.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        const paystack = new PaystackPop();

        try {
            paystack.newTransaction({
                key: publicKey,
                email: userEmail,
                amount: Math.ceil(amountNGN * 100), // Convert to kobo (integer)
                currency: 'NGN',
                metadata: {
                    custom_fields: [
                        { display_name: "User ID", variable_name: "user_id", value: user?.id },
                        { display_name: "Type", variable_name: "type", value: "wallet_funding" }
                    ]
                },
                onSuccess: async (transaction: any) => {
                    console.log('[PaystackFunding] Payment Successful. Transaction:', transaction);

                    try {
                        if (!user) throw new Error('User not authenticated');

                        // Call credit_wallet RPC with all 4 required parameters
                        const { data, error } = await supabase.rpc('credit_wallet', {
                            p_amount: amountNGN,
                            p_email: userEmail,
                            p_metadata: {
                                description: 'Wallet Funding via Paystack',
                                user_id: user.id,
                                type: 'wallet_funding'
                            },
                            p_reference: transaction.reference,
                        });

                        if (error) {
                            console.error('[PaystackFunding] Error crediting wallet:', error);
                            if (error.message && error.message.includes('Transaction already processed')) {
                                setMessage({ type: 'success', text: 'Transaction already processed. Wallet balance updated.' });
                                await fetchWallet();
                                return;
                            }
                            throw error;
                        }

                        console.log('[PaystackFunding] Wallet credited successfully!', data);
                        setMessage({ type: 'success', text: `Success! Wallet funded with ₦${amountNGN.toLocaleString()}` });
                        setAmount('');
                        await fetchWallet();

                    } catch (err: any) {
                        console.error('[PaystackFunding] Error crediting wallet:', err);
                        setMessage({ type: 'error', text: err.message || 'Payment verified but wallet update failed.' });
                    } finally {
                        setLoading(false);
                    }
                },
                onCancel: () => {
                    console.log('[PaystackFunding] Payment popup closed');
                    setLoading(false);
                    setMessage({ type: 'error', text: 'Payment cancelled.' });
                }
            });
        } catch (error) {
            console.error("Funding Error:", error);
            setLoading(false);
            setMessage({ type: 'error', text: 'Failed to initialize payment.' });
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm max-w-md mx-auto">
            <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                Fund Wallet
            </h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Amount (NGN)
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
                        <input
                            type="number"
                            className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold"
                            placeholder="1000"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            min={100}
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Minimum ₦100</p>
                </div>

                {message && (
                    <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                        <span className="material-symbols-outlined text-lg">
                            {message.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {message.text}
                    </div>
                )}

                <div className="w-full">
                    <button
                        onClick={handleFundWallet}
                        disabled={loading || !amount || Number(amount) < 100}
                        className={`w-full font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 
                    ${loading || !amount || Number(amount) < 100
                                ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed shadow-none'
                                : 'bg-primary hover:bg-primary/90 text-white active:scale-95'}`}
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">refresh</span>
                                Processing...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">payments</span>
                                Fund Wallet
                            </>
                        )}
                    </button>
                </div>

                <p className="text-center text-xs text-slate-400">
                    Secured by Paystack. Non-refundable.
                </p>
            </div>
        </div>
    );
};

export default PaystackFunding;
