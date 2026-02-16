import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { motion } from 'framer-motion';

const WalletSuccessPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { fetchWallet } = useApp();
    const [status, setStatus] = useState<'loading' | 'success' | 'timeout'>('loading');
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    const [userCheckAttempts, setUserCheckAttempts] = useState(0);
    const { user } = useApp();

    useEffect(() => {
        if (!reference) {
            navigate('/dashboard');
            return;
        }

        let transactionAttempts = 0;
        const maxAttempts = 20; // 30 seconds approx
        // let found = false; // This variable is no longer used in the updated logic

        const checkTransaction = async () => {
            // If user is not yet loaded, wait a bit (or let the polling continue)
            // But if RLS prevents read, we won't find it.

            const { data, error } = await supabase
                .from('wallet_transactions')
                .select('id, amount')
                .eq('reference', reference)
                .maybeSingle();

            if (data) {
                // found = true; // This variable is no longer used
                setStatus('success');
                await fetchWallet();

                setTimeout(() => {
                    navigate('/dashboard');
                }, 3000);
            } else {
                transactionAttempts++;
                if (transactionAttempts >= maxAttempts) {
                    setStatus('timeout');
                } else {
                    setTimeout(checkTransaction, 1500);
                }
            }
        };

        checkTransaction();

        // Cleanup not strictly necessary for simple polling but good practice
        // return () => { found = true; }; // This cleanup is no longer necessary as 'found' is not used
        return () => { }; // Empty cleanup function or remove if not needed
    }, [reference, navigate, fetchWallet, user]); // Added user dependency to re-trigger if user loads late


    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-md w-full shadow-lg border border-slate-200 dark:border-zinc-800 text-center">

                {status === 'loading' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="size-16 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center animate-pulse">
                            <span className="material-symbols-outlined text-3xl">sync</span>
                        </div>
                        <h2 className="text-xl font-bold">Verifying Payment...</h2>
                        <p className="text-slate-500 dark:text-zinc-400">Please wait while we confirm your transaction.</p>
                    </div>
                )}

                {status === 'success' && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl">check</span>
                        </div>
                        <h2 className="text-xl font-bold text-emerald-600">Payment Successful!</h2>
                        <p className="text-slate-500 dark:text-zinc-400">Your wallet has been funded.</p>
                        <p className="text-xs text-slate-400 mt-2">Redirecting to dashboard...</p>
                    </motion.div>
                )}

                {status === 'timeout' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl">
                                {!user ? 'lock' : 'hourglass_empty'}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold">
                            {!user ? 'Authentication Required' : 'Taking longer than usual'}
                        </h2>
                        <p className="text-slate-500 dark:text-zinc-400">
                            {!user
                                ? "We couldn't verify your session. Please log in to confirm your payment."
                                : "We haven't received confirmation yet, but your payment might still be processing."}
                        </p>
                        <button
                            onClick={() => navigate(!user ? '/login' : '/dashboard')}
                            className="mt-4 px-6 py-2 bg-primary text-white rounded-lg font-bold"
                        >
                            {!user ? 'Log In' : 'Go to Dashboard'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WalletSuccessPage;
