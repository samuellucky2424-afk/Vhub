import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppContextType, VirtualNumber, User, Wallet } from '../../types';
import { supabase } from '../lib/supabase';
import { formatNaira, koboToNaira } from '../utils/formatCurrency';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
};

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [activeNumbers, setActiveNumbers] = useState<VirtualNumber[]>([]);
    const [balance, setBalance] = useState(0.00);
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);

    // Auth & Data Fetching Effect - SINGLE INSTANCE
    useEffect(() => {
        let mounted = true;
        let currentUserId: string | null = null;

        // Check for recovery mode from URL hash on mount
        const checkRecoveryMode = () => {
            const hash = window.location.hash;
            const params = new URLSearchParams(hash.split('?')[1] || '');
            const type = params.get('type');
            if (type === 'recovery') {
                setIsRecoveryMode(true);
            } else {
                setIsRecoveryMode(false);
            }
        };

        checkRecoveryMode();

        // Listen for hash changes
        window.addEventListener('hashchange', checkRecoveryMode);

        // 1. Check Session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) {
                if (session?.user) {
                    currentUserId = session.user.id;
                    mapUser(session.user);
                    fetchOrders(session.user.id);
                }
                setLoading(false);
            }
        });

        // 2. Listen for Auth Changes - ONLY ONCE
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            console.log('Auth state change:', event, session?.user?.email);

            // Handle password recovery
            if (event === 'PASSWORD_RECOVERY') {
                window.location.href = '/#/reset-password';
                return;
            }

            // Handle email confirmation
            if (event === 'SIGNED_IN' && session?.user) {
                const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
                const type = urlParams.get('type');

                if (type === 'signup') {
                    console.log('Email confirmed for user:', session.user.email);
                    localStorage.setItem('emailConfirmed', 'true');
                    window.location.href = '/#/login';
                    return;
                }
            }

            // Prevent duplicate processing for same user
            const newUserId = session?.user?.id || null;
            if (newUserId === currentUserId && event === 'SIGNED_IN') {
                console.log('Skipping duplicate SIGNED_IN for same user');
                return;
            }

            // Skip INITIAL_SESSION if we already have the same user
            if (event === 'INITIAL_SESSION' && newUserId === currentUserId) {
                console.log('Skipping duplicate INITIAL_SESSION for same user');
                return;
            }

            currentUserId = newUserId;

            if (session?.user) {
                mapUser(session.user);
                fetchOrders(session.user.id);
            } else {
                setUser(null);
                setActiveNumbers([]);
            }
            setLoading(false);
        });

        return () => {
            mounted = false;
            window.removeEventListener('hashchange', checkRecoveryMode);
            subscription.unsubscribe();
        };
    }, []);

    const mapUser = (authUser: any) => {
        setUser({
            id: authUser.id,
            name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            email: authUser.email || '',
            avatar: authUser.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
            plan: 'Free',
            memberSince: new Date(authUser.created_at).getFullYear().toString()
        });
    };

    const fetchWallet = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
            console.log('App: Fetching wallet for user', authUser.id);
            const { data, error } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', authUser.id)
                .maybeSingle();

            if (error) {
                console.error('App: Wallet fetch error:', error.code, error.message);
            }

            if (data) {
                console.log('Wallet raw kobo:', data.balance_kobo);
                console.log('Wallet formatted:', formatNaira(data.balance_kobo ?? 0));
                setWallet(data);
                setBalance(koboToNaira(Number(data.balance_kobo ?? 0)));
            } else {
                console.log('App: No wallet found, setting default');
                setWallet({ id: 'temp', user_id: authUser.id, balance_kobo: 0, locked_balance: 0, currency: 'NGN' });
                setBalance(0);
            }
        }
    };

    // Initial wallet fetch when user is set (but not on INITIAL_SESSION)
    useEffect(() => {
        if (user?.id) {
            fetchWallet();
        }
    }, [user?.id]);

    // Wallet Realtime Subscription - SINGLE INSTANCE WITH PROPER CLEANUP
    useEffect(() => {
        let mounted = true;
        let walletChannel: any = null;
        let retryCount = 0;
        const maxRetries = 3;
        let retryTimeoutId: number | null = null;
        let fallbackPollId: number | null = null;

        const clearRetryTimeout = () => {
            if (retryTimeoutId !== null) {
                window.clearTimeout(retryTimeoutId);
                retryTimeoutId = null;
            }
        };

        const stopFallbackPolling = () => {
            if (fallbackPollId !== null) {
                window.clearInterval(fallbackPollId);
                fallbackPollId = null;
            }
        };

        const refreshWalletFallback = () => {
            if (!mounted || !user?.id) return;
            fetchWallet();
        };

        const startFallbackPolling = () => {
            if (fallbackPollId !== null) return;

            console.warn('App: Wallet realtime unavailable, falling back to periodic refresh');
            refreshWalletFallback();
            fallbackPollId = window.setInterval(refreshWalletFallback, 15000);
        };

        if (user?.id) {
            console.log('App: Setting up wallet subscription for user', user.id);
            window.addEventListener('focus', refreshWalletFallback);

            const createSubscription = () => {
                clearRetryTimeout();

                // Clean up any existing subscription first
                if (walletChannel) {
                    supabase.removeChannel(walletChannel);
                    walletChannel = null;
                }

                // Create new subscription with timeout handling
                walletChannel = supabase
                    .channel(`wallet-changes-${user.id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'wallets',
                            filter: `user_id=eq.${user.id}`
                        },
                        (payload) => {
                            if (!mounted) {
                                console.log('App: Wallet update received after unmount, ignoring');
                                return;
                            }

                            console.log('App: Wallet update received', payload);
                            if (payload.new) {
                                const updated = payload.new as Wallet;
                                setWallet(updated);
                                setBalance(koboToNaira(Number(updated.balance_kobo ?? 0)));
                                console.log('Wallet raw kobo:', updated.balance_kobo);
                                console.log('Wallet formatted:', formatNaira(updated.balance_kobo ?? 0));
                            }
                        }
                    )
                    .subscribe((status, err) => {
                        if (!mounted) return;

                        console.log('App: Wallet subscription status', status, err);

                        if (status === 'SUBSCRIBED') {
                            retryCount = 0; // Reset retry count on success
                            stopFallbackPolling();
                        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
                            if (retryCount < maxRetries) {
                                retryCount++;
                                console.log(`App: Retrying wallet subscription (${retryCount}/${maxRetries})`);
                                retryTimeoutId = window.setTimeout(createSubscription, 2000 * retryCount); // Exponential backoff
                            } else {
                                console.warn('App: Wallet subscription failed after max retries');
                                startFallbackPolling();
                            }
                        } else if (status === 'CHANNEL_ERROR') {
                            console.warn('App: Wallet realtime channel error, waiting for reconnect path');
                        }
                    });
            };

            createSubscription();
        }

        return () => {
            mounted = false;
            clearRetryTimeout();
            stopFallbackPolling();
            window.removeEventListener('focus', refreshWalletFallback);
            if (walletChannel) {
                console.log('App: Cleaning up wallet subscription');
                supabase.removeChannel(walletChannel);
                walletChannel = null;
            }
        };
    }, [user?.id]);

    const fetchOrders = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) {
                const mapped: VirtualNumber[] = data.map(o => {
                    let status: 'Active' | 'Expired' | 'Completed' | 'Pending' | 'Failed' | 'Refunded' = 'Pending';

                    // Status derived from BOTH status (SMS lifecycle) and payment_status columns
                    // Priority: status column first (set by sync_order_status), then payment_status
                    const smsStatus = o.status; // SMS lifecycle: processing, completed, refunded, etc.
                    const ps = o.payment_status;

                    if (smsStatus === 'completed' || ps === 'completed') {
                        status = 'Completed';
                    } else if (smsStatus === 'refunded' || ps === 'refunded') {
                        status = 'Refunded';
                    } else if (smsStatus === 'failed' || ps === 'failed' || ps === 'manual_intervention_required') {
                        status = 'Failed';
                    } else if (smsStatus === 'cancelled' || ps === 'cancelled') {
                        status = 'Expired';
                    } else if (smsStatus === 'processing' || smsStatus === 'number_received' || smsStatus === 'waiting_sms') {
                        status = 'Active';
                    } else {
                        // 'pending', 'paid', or any other status = still waiting
                        status = 'Pending';
                    }

                    // FIX: sms_code must be the clean OTP only — never the full SMS message
                    // orders.sms_code column holds the clean code (e.g. "123456")
                    const smsCode = o.sms_code || o.metadata?.sms_code;

                    return {
                        id: o.id,
                        // FIX: Check phone_number column first (now properly saved by atomic_purchase_verification),
                        // then fall back to metadata. Never show '---' when a number exists.
                        number: o.phone_number || o.metadata?.phonenumber || o.metadata?.number || (status === 'Pending' ? 'Processing...' : 'N/A'),
                        country: o.metadata?.country || 'US',
                        service: o.service_type || 'Unknown',
                        status: status as any,
                        createdAt: o.created_at,
                        expiresAt: new Date(new Date(o.created_at).getTime() + 10 * 60 * 1000).toISOString(),
                        logs: smsCode ? [{
                            id: `${o.id}-log`,
                            sender: o.service_type || 'Service',
                            message: `Your verification code is ${smsCode}`,
                            code: smsCode,
                            receivedAt: new Date(o.created_at).toLocaleString(),
                            isRead: false
                        }] : []
                    };
                });
                setActiveNumbers(mapped);


            }
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    };

    const isAuthenticated = !!user;

    const login = (userData?: Partial<User>) => {
        // Handled by Supabase auth listener
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Always clean up state regardless of signOut success
            setUser(null);
            setActiveNumbers([]);
            setWallet(null);
            setBalance(0);
        }
    };

    const addNumber = (newNumber: VirtualNumber) => {
        setActiveNumbers([newNumber, ...activeNumbers]);
    };

    const deductBalance = (amount: number) => {
        setBalance(prev => Math.max(0, prev - amount));
    };

    const refreshNumbers = async () => {
        if (user?.id || (await supabase.auth.getUser()).data.user?.id) {
            const userId = user?.id || (await supabase.auth.getUser()).data.user?.id;
            if (userId) await fetchOrders(userId);
        }
    };


    return (
        <AppContext.Provider value={{
            user,
            activeNumbers,
            balance,
            wallet,
            loading,
            isRecoveryMode,
            isAuthenticated,
            login,
            logout,
            addNumber,
            deductBalance,
            refreshNumbers,
            fetchWallet
        }}>
            {children}
        </AppContext.Provider>
    );
};

export default AppContext;
