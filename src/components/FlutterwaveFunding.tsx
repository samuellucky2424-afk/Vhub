import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import {
    FLUTTERWAVE_PAYMENT_METHODS,
    getFlutterwaveErrorMessage,
} from '../lib/payments/flutterwave.js';

const FlutterwaveFunding: React.FC = () => {
    const { user } = useApp();
    const [amount, setAmount] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const publicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || '';

    const handleFundWallet = async () => {
        const amountNGN = Number(amount) || 0;

        if (amountNGN < 2000) {
            setMessage({ type: 'error', text: 'Minimum deposit is ₦2,000' });
            return;
        }

        if (!publicKey) {
            setMessage({ type: 'error', text: 'Flutterwave public key is missing.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('User not authenticated');
            }

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/initialize-wallet-funding`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    amount: amountNGN,
                    payment_method: FLUTTERWAVE_PAYMENT_METHODS.auto,
                }),
            });

            const rawResponse = await response.text();
            const parsedResponse = rawResponse ? JSON.parse(rawResponse) : {};

            if (!response.ok || !parsedResponse.success || !parsedResponse.payment_link) {
                throw new Error(
                    parsedResponse.error ||
                    parsedResponse.message ||
                    getFlutterwaveErrorMessage(parsedResponse, response.status),
                );
            }

            window.location.assign(parsedResponse.payment_link);
        } catch (error) {
            console.error('[FlutterwaveFunding] Initialization error:', error);
            setLoading(false);
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Failed to initialize Flutterwave payment.',
            });
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
                            placeholder="2000"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                            min={2000}
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Minimum ₦2,000</p>
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
                        disabled={loading || !amount || Number(amount) < 2000 || !user}
                        className={`w-full font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${loading || !amount || Number(amount) < 2000 || !user
                            ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-primary hover:bg-primary/90 text-white active:scale-95'}`}
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">refresh</span>
                                Redirecting...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">payments</span>
                                Continue to Flutterwave
                            </>
                        )}
                    </button>
                </div>

                <p className="text-center text-xs text-slate-400">
                    Secured by Flutterwave. Funds are credited after successful verification.
                </p>
            </div>
        </div>
    );
};

export default FlutterwaveFunding;
