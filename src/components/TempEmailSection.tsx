import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useApp } from '../../App';

// ─── Constants & Types ───
const EXPIRY_MINUTES = 10;
const EMAIL_PRICE = '₦1,300.00';

const SERVICES = [
    { id: 'Default', name: 'Any Service', icon: 'public' },
    { id: 'TikTok', name: 'TikTok', icon: 'tiktok' },
    { id: 'Instagram', name: 'Instagram', icon: 'camera_alt' },
    { id: 'Facebook', name: 'Facebook', icon: 'facebook' },
    { id: 'Twitter', name: 'Twitter / X', icon: 'tag' },
    { id: 'WhatsApp', name: 'WhatsApp', icon: 'chat' },
    { id: 'Telegram', name: 'Telegram', icon: 'send' },
    { id: 'Snapchat', name: 'Snapchat', icon: 'ghost' },
];

interface TempEmailMessage {
    id: string;
    sender: string;
    subject: string;
    body: string;
    otp_code?: string;
    verification_link?: string;
    received_at: string;
}

interface TempEmail {
    id: string;
    email_address: string;
    status: 'active' | 'used' | 'expired';
    service: string;
    created_at: string;
    expires_at: string;
    temp_email_messages?: TempEmailMessage[];
}

// ─── Countdown Timer Component ───
const CountdownTimer: React.FC<{ expiresAt: string; onExpired?: () => void }> = ({ expiresAt, onExpired }) => {
    const [timeLeft, setTimeLeft] = useState(EXPIRY_MINUTES * 60);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const expiry = new Date(expiresAt).getTime();
            const remaining = Math.floor((expiry - Date.now()) / 1000);
            return remaining > 0 ? remaining : 0;
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(timer);
                onExpired?.();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [expiresAt, onExpired]);

    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    const isLow = timeLeft < 60;

    return (
        <div className={`font-mono font-bold px-2.5 py-1 rounded text-xs select-none ${isLow
            ? 'text-rose-600 dark:text-rose-400 bg-rose-100/50 dark:bg-rose-900/30 animate-pulse'
            : 'text-indigo-700 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/30'
            }`}>
            {m}:{s}
        </div>
    );
};

// ─── Copy Button Component ───
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`shrink-0 p-1.5 rounded-lg transition-colors cursor-pointer ${copied
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400'
                }`}
            title="Copy email address"
        >
            <span className="material-symbols-outlined text-[16px]">
                {copied ? 'check' : 'content_copy'}
            </span>
        </button>
    );
};

// ─── Main Component ───
export const TempEmailSection: React.FC = () => {
    const { user, fetchWallet } = useApp();
    const [emails, setEmails] = useState<TempEmail[]>([]);
    const [buying, setBuying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<string>(SERVICES[0].id);
    const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Fetch emails from DB ───
    const fetchEmails = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
            const resp = await fetch(`${supabaseUrl}/functions/v1/tempmail-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ action: 'list_tempmails' }),
            });

            const data = await resp.json();
            if (data?.success && data.emails) {
                setEmails(data.emails);
            }
        } catch (err) {
            console.error('[TempEmail] Fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchEmails();
    }, [fetchEmails]);

    // ─── Realtime subscription ───
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('temp_emails_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'temp_emails',
                filter: `user_id=eq.${user.id}`,
            }, () => {
                fetchEmails();
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'temp_email_messages',
            }, () => {
                fetchEmails();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id, fetchEmails]);

    // ─── Poll Gmail every 5s when there are active emails ───
    const triggerPoller = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
            await fetch(`${supabaseUrl}/functions/v1/tempmail-gmail-poller`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ limit: 10 }),
            });
        } catch (err) {
            console.error('[TempEmail] Poller trigger failed:', err);
        }
        // Always refresh the email list after polling
        fetchEmails();
    }, [fetchEmails]);

    const hasActive = React.useMemo(() => emails.some((e) => e.status === 'active'), [emails]);

    useEffect(() => {
        if (!hasActive) {
            if (pollerRef.current) clearInterval(pollerRef.current);
            return;
        }

        pollerRef.current = setInterval(triggerPoller, 5000);
        triggerPoller();

        return () => {
            if (pollerRef.current) clearInterval(pollerRef.current);
        };
    }, [hasActive, triggerPoller]);

    // ─── Handle Expiration: directly refund via RPC ───
    const handleExpired = useCallback(async (emailId?: string) => {
        if (!user?.id) return;
        try {
            // 1. Find the expired active email
            const activeEmail = emails.find(e =>
                (emailId ? e.id === emailId : e.status === 'active')
            );

            if (activeEmail) {
                // 2. Mark as expired in DB
                await supabase
                    .from('temp_emails')
                    .update({ status: 'expired' })
                    .eq('id', activeEmail.id);

                // 3. Directly refund via credit_wallet RPC
                const refRef = `REFUND-TMP-AUTO-${activeEmail.id}`;
                const { error: rpcError } = await supabase.rpc('credit_wallet', {
                    p_user_id: user.id,
                    p_amount: 130000, // TEMPMAIL_PRICE_KOBO
                    p_reference: refRef,
                    p_metadata: { source: 'tempmail_refund_auto', email: activeEmail.email_address }
                });

                if (rpcError) {
                    console.error('[TempEmail] Refund RPC failed:', rpcError);
                } else {
                    console.log(`[TempEmail] Refunded ${activeEmail.email_address} successfully`);
                }
            }

            // 4. Refresh UI
            await fetchEmails();
            await fetchWallet();
        } catch (err) {
            console.error('[TempEmail] handleExpired error:', err);
            // Still refresh in case of partial success
            fetchEmails();
            fetchWallet();
        }
    }, [user?.id, emails, fetchEmails, fetchWallet]);

    // ─── Buy Email ───
    const handleBuyEmail = async () => {
        if (!user?.id || buying) return;
        setBuying(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Please log in again');

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
            const resp = await fetch(`${supabaseUrl}/functions/v1/tempmail-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ action: 'purchase_tempmail', service: selectedService }),
            });

            const data = await resp.json();

            if (!resp.ok || !data?.success) {
                throw new Error(data?.message || 'Purchase failed');
            }

            if (data.email) {
                setEmails((prev) => [data.email, ...prev]);
                setExpandedId(data.email.id);
            }

            fetchWallet();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBuying(false);
        }
    };

    // ─── Helper for effective status ───
    const getEffectiveStatus = (email: TempEmail) => {
        if (email.status === 'used') return 'used';
        if (email.status === 'expired') return 'expired';
        if (new Date(email.expires_at).getTime() < Date.now()) return 'expired';
        return 'active';
    };

    // ─── Helper for service icon ───
    const getServiceIcon = (serviceId: string) => {
        const s = SERVICES.find(x => x.id === serviceId);
        return s?.icon || 'public';
    };

    return (
        <div>
            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded-lg text-sm mb-4 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">error</span>
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700 cursor-pointer">
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ─── Left: Buy Email Card ─── */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-6 flex-1 flex flex-col">


                        {/* Service Selector */}
                        <div className="mb-6">
                            <div className="relative">
                                <select
                                    value={selectedService}
                                    onChange={(e) => setSelectedService(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl py-3 pl-12 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium transition-shadow cursor-pointer"
                                    disabled={buying}
                                >
                                    {SERVICES.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
                                    <span className="material-symbols-outlined">{getServiceIcon(selectedService)}</span>
                                </div>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
                                    <span className="material-symbols-outlined">expand_more</span>
                                </div>
                            </div>

                        </div>

                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 mb-6 space-y-3 mt-auto border border-slate-100 dark:border-zinc-800/80">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 dark:text-zinc-400 font-medium">Price</span>
                                <span className="font-bold text-slate-900 dark:text-white">{EMAIL_PRICE}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 dark:text-zinc-400 font-medium">Valid for</span>
                                <span className="text-slate-700 dark:text-zinc-300 font-medium">1 message</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 dark:text-zinc-400 font-medium">Duration</span>
                                <span className="font-mono text-xs font-bold text-slate-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded shadow-sm border border-slate-200 dark:border-zinc-700">5 minutes</span>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.01, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleBuyEmail}
                            disabled={buying}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-xl transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {buying ? (
                                <span className="material-symbols-outlined animate-spin text-[22px]">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-[22px]">shopping_cart_checkout</span>
                            )}
                            {buying ? 'Generating & Purchasing...' : `Buy Email for ${EMAIL_PRICE}`}
                        </motion.button>
                    </div>
                </div>

                {/* ─── Right: Email Board ─── */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/80 dark:bg-zinc-800/40">
                        <div className="flex items-center gap-2">
                            <div className="bg-primary hover:bg-primary text-white p-1.5 rounded-lg shadow-sm">
                                <span className="material-symbols-outlined text-[18px] block">inbox</span>
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">Email Inbox</h3>
                        </div>
                        <span className="text-xs text-slate-500 font-bold bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-700 shadow-sm">
                            {emails.length} stored
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-3 animate-spin block">progress_activity</span>
                                <p className="text-sm font-medium">Loading your emails...</p>
                            </div>
                        ) : emails.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 px-6 text-center">
                                <div className="size-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl opacity-50 block">forward_to_inbox</span>
                                </div>
                                <p className="text-slate-800 dark:text-zinc-300 font-bold text-lg mb-1">Inbox is empty</p>
                                <p className="text-sm">Select a service and buy a temporary email to receive your verification codes.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 p-2">
                                {emails.map((email) => {
                                    const effectiveStatus = getEffectiveStatus(email);
                                    const isExpanded = expandedId === email.id;
                                    const messages = email.temp_email_messages || [];
                                    const latestMessage = messages[0]; // Assuming ordered descending by DB
                                    const serviceName = email.service || 'Default';
                                    const serviceIcon = getServiceIcon(serviceName);

                                    return (
                                        <motion.div
                                            key={email.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`rounded-xl overflow-hidden transition-all duration-200 my-1 border ${isExpanded
                                                ? 'border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/5 shadow-sm'
                                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                                                }`}
                                        >
                                            {/* Email Header row */}
                                            <div
                                                className="p-3.5 cursor-pointer flex flex-col gap-2"
                                                onClick={() => setExpandedId(isExpanded ? null : email.id)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                        <div className="shrink-0 size-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500">
                                                            <span className="material-symbols-outlined text-[18px]">{serviceIcon}</span>
                                                        </div>
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate select-all">
                                                                    {email.email_address}
                                                                </span>
                                                                <div onClick={(e) => e.stopPropagation()}>
                                                                    <CopyButton text={email.email_address} />
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-medium truncate uppercase tracking-wider">
                                                                {serviceName}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 flex flex-col items-end gap-1.5 ml-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${effectiveStatus === 'active'
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                                            : effectiveStatus === 'used'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                                                : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                                            }`}>
                                                            {effectiveStatus === 'active' ? (
                                                                <><span className="size-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span> Listening</>
                                                            ) : effectiveStatus === 'used' ? (
                                                                <><span className="size-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Received</>
                                                            ) : (
                                                                <><span className="size-1.5 rounded-full bg-slate-400 mr-1.5"></span> Expired</>
                                                            )}
                                                        </span>
                                                        {effectiveStatus === 'active' && (
                                                            <div onClick={(e) => e.stopPropagation()}>
                                                                <CountdownTimer expiresAt={email.expires_at} onExpired={() => handleExpired(email.id)} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Content Body */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="px-3.5 pb-4 pt-1">
                                                            {/* Empty Active State */}
                                                            {effectiveStatus === 'active' && (
                                                                <div className="bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-900/30 rounded-xl p-6 text-center shadow-sm">
                                                                    <div className="relative inline-flex items-center justify-center mb-4">
                                                                        <div className="absolute inset-0 bg-amber-200 dark:bg-amber-500 rounded-full animate-ping opacity-20"></div>
                                                                        <div className="size-12 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 relative z-10">
                                                                            <span className="material-symbols-outlined text-2xl animate-bounce mt-2">mail</span>
                                                                        </div>
                                                                    </div>
                                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">Waiting for email from {serviceName}...</h4>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[250px] mx-auto">
                                                                        Go to {serviceName} and request a verification code to this address. It will appear here instantly.
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Received Message State */}
                                                            {messages.length > 0 && (
                                                                <div className="space-y-3">
                                                                    {messages.map((msg, idx) => (
                                                                        <div key={msg.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/60 rounded-xl overflow-hidden shadow-sm">
                                                                            {/* Giant OTP Banner if present */}
                                                                            {msg.otp_code && (
                                                                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 p-4 text-center">
                                                                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-2">Your Verification Code</span>
                                                                                    <div className="font-mono text-3xl font-black tracking-[0.2em] text-emerald-700 dark:text-emerald-300 select-all">
                                                                                        {msg.otp_code}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Verification Link Banner if present */}
                                                                            {msg.verification_link && (
                                                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 p-4 text-center">
                                                                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-3">Verification Link</span>
                                                                                    <a
                                                                                        href={msg.verification_link}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm shadow-indigo-200 dark:shadow-none"
                                                                                    >
                                                                                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                                                                        Open Link
                                                                                    </a>
                                                                                </div>
                                                                            )}

                                                                            <div className="p-3">
                                                                                <div className="flex items-center gap-2 mb-2 text-xs">
                                                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                                                                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{msg.sender}</span>
                                                                                    <span className="ml-auto text-[10px] text-slate-400">{new Date(msg.received_at).toLocaleTimeString()}</span>
                                                                                </div>
                                                                                <div className="font-semibold text-[13px] text-slate-900 dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                                                                                    {msg.subject || '(No subject)'}
                                                                                </div>
                                                                                <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-zinc-800/50 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                                                                                    {msg.body?.replace(/<[^>]*>/g, '').substring(0, 1000) || '(Empty body)'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Legacy Used without Messages */}
                                                            {effectiveStatus === 'used' && messages.length === 0 && (
                                                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-4 text-center text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                                                    <span className="material-symbols-outlined text-2xl mb-2 block text-emerald-500">check_circle</span>
                                                                    Used (Legacy message record not found)
                                                                </div>
                                                            )}

                                                            {/* Expired State */}
                                                            {effectiveStatus === 'expired' && (
                                                                <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30 rounded-xl p-4 text-center text-sm font-medium text-rose-700 dark:text-rose-400">
                                                                    <span className="material-symbols-outlined text-2xl mb-2 block opacity-50">timer_off</span>
                                                                    This email has expired. Money refunded to wallet.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
