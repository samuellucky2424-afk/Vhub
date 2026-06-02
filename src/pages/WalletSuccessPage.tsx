import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { motion } from 'framer-motion';
import { extractFlutterwaveRedirectParams, isFlutterwavePaymentSuccessful } from '../lib/payments/flutterwave.js';

const WalletSuccessPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { fetchWallet } = useApp();
    const [status, setStatus] = useState<'loading' | 'success' | 'timeout' | 'cancelled'>('loading');
    const redirectParams = extractFlutterwaveRedirectParams(searchParams.toString());
    const reference = redirectParams.tx_ref;
    const transactionId = redirectParams.transaction_id;
    const gatewayStatus = redirectParams.status;

    const { user, loading: authLoading } = useApp();

    useEffect(() => {
        if (!reference) {
            navigate('/dashboard');
            return;
        }

        // Wait for auth to finish loading before polling
        if (authLoading) {
            console.log('WalletSuccess: Waiting for auth to load...');
            return;
        }

        if (gatewayStatus && !isFlutterwavePaymentSuccessful(gatewayStatus) && gatewayStatus.toLowerCase() !== 'completed') {
            setStatus('cancelled');
            return;
        }

        console.log('WalletSuccess: Auth loaded, user:', user ? 'authenticated' : 'not authenticated');

        let transactionAttempts = 0;
        const maxAttempts = 20; // 30 seconds approx

        const verifyTransaction = async () => {
            if (!user || !transactionId) {
                return;
            }

            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    return;
                }

                await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-wallet-funding`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        tx_ref: reference,
                        transaction_id: transactionId,
                    }),
                });
            } catch (error) {
                console.log('WalletSuccess: verify-wallet-funding still pending', error);
            }
        };

        const checkTransaction = async () => {
            const { data, error } = await supabase
                .from('wallet_transactions')
                .select('id, amount_kobo')
                .eq('reference', reference)
                .maybeSingle();

            if (error) {
                console.error('WalletSuccess: Transaction lookup error:', error);
            } else if (data) {
                console.log('WalletSuccess: Transaction found!', data);
                setStatus('success');
                await fetchWallet();

                setTimeout(() => {
                    navigate('/dashboard');
                }, 3000);
            } else {
                transactionAttempts++;
                console.log(`WalletSuccess: Attempt ${transactionAttempts}/${maxAttempts}, no transaction yet`);
                if (transactionAttempts >= maxAttempts) {
                    setStatus('timeout');
                } else {
                    if (transactionAttempts === 1 || transactionAttempts % 3 === 0) {
                        await verifyTransaction();
                    }
                    setTimeout(checkTransaction, 1500);
                }
            }
        };

        verifyTransaction().finally(checkTransaction);

        return () => { };
    }, [reference, transactionId, gatewayStatus, navigate, fetchWallet, user, authLoading]);


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

                {status === 'cancelled' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="size-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl">close</span>
                        </div>
                        <h2 className="text-xl font-bold">Payment Not Completed</h2>
                        <p className="text-slate-500 dark:text-zinc-400">Flutterwave reported that this transaction was cancelled or not completed.</p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="mt-4 px-6 py-2 bg-primary text-white rounded-lg font-bold"
                        >
                            Back to Dashboard
                        </button>
                    </div>
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
