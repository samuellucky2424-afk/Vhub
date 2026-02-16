import React, { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { useApp } from '../App';
import { VirtualNumber } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

const ActiveNumbers: React.FC = () => {
    const { activeNumbers, refreshNumbers } = useApp();
    const [selectedNumber, setSelectedNumber] = useState<VirtualNumber | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());

    const checkStatus = async (orderId: string) => {
        setCheckingIds(prev => new Set(prev).add(orderId));
        try {
            // Using fetch explicitly to avoid potential auth/session issues with invoke()
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smspool-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ action: 'check_order', order_id: orderId })
            });

            if (!response.ok) {
                throw new Error(`Function returned ${response.status}`);
            }

            const data = await response.json();
            console.log("Check Status Result:", data);
            await refreshNumbers();
        } catch (err) {
            console.error("Failed to check status:", err);
        } finally {
            setCheckingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderId);
                return newSet;
            });
        }
    };

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await refreshNumbers();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    // Realtime Subscription & Polling Trigger
    // 1. Trigger polling when activeNumbers updates
    useEffect(() => {
        const triggerPolling = async () => {
            const itemsToPoll = activeNumbers.filter(n =>
                (n.status === 'Active' || n.status === 'Pending') &&
                (!n.logs || n.logs.length === 0 || !n.logs.some(l => l.code))
            );

            for (const item of itemsToPoll) {
                // Fire and forget - don't await the result as it might take 100s
                console.log(`Triggering background polling for ${item.id}...`);
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smspool-service`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({ action: 'poll_sms', order_id: item.id })
                }).catch(err => console.error("Polling trigger error:", err));
            }
        };

        if (activeNumbers.length > 0) {
            triggerPolling();
        }
    }, [activeNumbers]);

    // 2. Setup Realtime Subscription (Mount only)
    useEffect(() => {
        const channel = supabase
            .channel('verifications-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'verifications',
                },
                (payload) => {
                    console.log("Realtime: New verification received!", payload);
                    // Refresh data to show the new code
                    refreshNumbers();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully subscribed to verifications channel');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount


    // Helper to get latest log info
    const getLatestLog = (num: VirtualNumber) => {
        if (num.logs && num.logs.length > 0) {
            return num.logs[0];
        }
        return null;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCode(text);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto w-full h-full overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">My Numbers</h1>
                    <p className="text-slate-500 dark:text-slate-400">View your purchased numbers and their received verification codes.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        <span className={`material-symbols-outlined ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                        Refresh
                    </button>
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm font-medium shadow-sm">
                        Active: <span className="text-emerald-500 font-bold">{activeNumbers.filter(n => n.status === 'Active').length}</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm font-medium shadow-sm">
                        Total: <span className="text-slate-900 dark:text-white font-bold">{activeNumbers.length}</span>
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-5 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Service</th>
                                <th className="px-6 py-5 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Number</th>
                                <th className="px-6 py-5 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Latest OTP Code</th>
                                <th className="px-6 py-5 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Date & Time</th>
                                <th className="px-6 py-5 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {activeNumbers.map((num) => {
                                const latestLog = getLatestLog(num);
                                return (
                                    <tr key={num.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                                                    <span className="material-symbols-outlined">
                                                        {num.service === 'WhatsApp' ? 'chat' : num.service === 'Telegram' ? 'send' : 'public'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">{num.service}</p>
                                                    <p className="text-xs text-slate-500">{num.country} Region</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-mono font-medium text-slate-700 dark:text-slate-300">{num.number}</p>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${num.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                num.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                    num.status === 'Refunded' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                        num.status === 'Failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            'bg-slate-100 text-slate-500'}`}>
                                                {num.status === 'Active' && <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse"></span>}
                                                {num.status === 'Pending' && <span className="size-1.5 bg-amber-500 rounded-full animate-pulse"></span>}
                                                {num.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {latestLog?.code && latestLog.code !== 'PENDING' ? (
                                                <button
                                                    onClick={() => copyToClipboard(latestLog.code!)}
                                                    className="group/btn relative flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-primary hover:text-primary px-3 py-1.5 rounded-lg transition-all w-fit"
                                                >
                                                    <span className="font-mono font-bold text-lg tracking-widest">{latestLog.code}</span>
                                                    <span className="material-symbols-outlined text-sm opacity-50 group-hover/btn:opacity-100 transition-opacity">
                                                        {copiedCode === latestLog.code ? 'check' : 'content_copy'}
                                                    </span>
                                                    {copiedCode === latestLog.code && (
                                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded">Copied!</span>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-2 text-slate-400 italic text-sm">
                                                        <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse"></span>
                                                        Waiting for SMS...
                                                    </div>
                                                    <button
                                                        onClick={() => checkStatus(num.id)}
                                                        disabled={checkingIds.has(num.id)}
                                                        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                                                    >
                                                        {checkingIds.has(num.id) ? 'Checking...' : 'Check Status'}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                    {latestLog ? latestLog.receivedAt : new Date(num.status === 'Pending' ? Date.now() : num.expiresAt).toLocaleDateString()}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {latestLog ? 'Received' : 'Purchase Date'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedNumber(num)}
                                                className="size-9 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-primary transition-all ml-auto"
                                                title="View Full History"
                                            >
                                                <span className="material-symbols-outlined">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {activeNumbers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="size-20 bg-slate-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                                                <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-4xl">inbox</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No active numbers</h3>
                                            <p className="text-slate-500 max-w-xs mx-auto mt-2 mb-6">Purchase a virtual number to start receiving verification codes instantly.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 pb-20">
                {activeNumbers.map((num) => {
                    const latestLog = getLatestLog(num);
                    return (
                        <div key={num.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined">
                                            {num.service === 'WhatsApp' ? 'chat' : num.service === 'Telegram' ? 'send' : 'public'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{num.service}</h3>
                                        <p className="text-xs text-slate-500">{num.country}</p>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${num.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    num.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        num.status === 'Refunded' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                            num.status === 'Failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                'bg-slate-100 text-slate-500'}`}>
                                    {num.status === 'Active' && <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse"></span>}
                                    {num.status === 'Pending' && <span className="size-1.5 bg-amber-500 rounded-full animate-pulse"></span>}
                                    {num.status}
                                </span>
                            </div>

                            {/* Number & Date */}
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Number</p>
                                    <p className="font-mono font-medium text-slate-900 dark:text-white text-lg">{num.number}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Date</p>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                        {latestLog ? latestLog.receivedAt.split('T')[0] : new Date(num.status === 'Pending' ? Date.now() : num.expiresAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* OTP Section */}
                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 mb-4">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 text-center">Latest Verification Code</p>
                                {latestLog?.code && latestLog.code !== 'PENDING' ? (
                                    <button
                                        onClick={() => copyToClipboard(latestLog.code!)}
                                        className="w-full flex flex-col items-center gap-2 group/btn"
                                    >
                                        <span className="font-mono font-bold text-3xl tracking-[0.2em] text-slate-900 dark:text-white group-hover/btn:text-primary transition-colors">
                                            {latestLog.code}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs text-primary font-bold">
                                            <span className="material-symbols-outlined text-sm">
                                                {copiedCode === latestLog.code ? 'check' : 'content_copy'}
                                            </span>
                                            {copiedCode === latestLog.code ? 'Copied!' : 'Tap to Copy'}
                                        </div>
                                    </button>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 py-2">
                                        <div className="flex items-center gap-2 text-slate-400 italic text-sm animate-pulse">
                                            <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                            Waiting for SMS...
                                        </div>
                                        <button
                                            onClick={() => checkStatus(num.id)}
                                            disabled={checkingIds.has(num.id)}
                                            className="text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg font-bold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                                        >
                                            {checkingIds.has(num.id) ? 'Checking...' : 'Check Status'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* View Details Button */}
                            <button
                                onClick={() => setSelectedNumber(num)}
                                className="w-full py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">history</span>
                                View Full History
                            </button>
                        </div>
                    );
                })}

                {activeNumbers.length === 0 && (
                    <div className="text-center py-10 px-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
                        <div className="size-16 bg-slate-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-3xl">inbox</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No active numbers</h3>
                        <p className="text-slate-500 mt-2 text-sm">Purchase a virtual number to start receiving verification codes.</p>
                    </div>
                )}
            </div>

            {/* Modal for viewing all logs */}
            <AnimatePresence>
                {selectedNumber && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedNumber(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-zinc-800"
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/30">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">
                                            {selectedNumber.service === 'WhatsApp' ? 'chat' : selectedNumber.service === 'Telegram' ? 'send' : 'public'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedNumber.service} History</h3>
                                        <p className="text-xs text-slate-500 font-mono">{selectedNumber.number}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedNumber(null)}
                                    className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors text-slate-500"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-4">
                                {selectedNumber.logs.length > 0 ? (
                                    selectedNumber.logs.map((log) => (
                                        <div key={log.id} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-sm">verified</span>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">{log.sender}</span>
                                                </div>
                                                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-zinc-900 px-2 py-1 rounded-full">{log.receivedAt}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-lg italic">
                                                "{log.message}"
                                            </p>
                                            {log.code && (
                                                <div className="flex flex-col gap-2">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Verification Code</p>
                                                    <div className="flex items-center gap-3">
                                                        <span className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-4 py-2 rounded-lg font-mono font-bold text-xl text-primary tracking-widest select-all">
                                                            {log.code}
                                                        </span>
                                                        <button
                                                            onClick={() => copyToClipboard(log.code!)}
                                                            className="text-xs font-bold text-primary hover:underline"
                                                        >
                                                            {copiedCode === log.code ? 'Copied' : 'Copy'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12">
                                        <span className="material-symbols-outlined text-slate-300 text-4xl mb-2">history_toggle_off</span>
                                        <p className="text-slate-500">No messages received yet.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ActiveNumbers;