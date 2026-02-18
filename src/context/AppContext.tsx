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

    // Auth & Data Fetching Effect
    useEffect(() => {
        // 1. Check Session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                mapUser(session.user);
                fetchOrders(session.user.id);
            }
            setLoading(false);
        });

        // 2. Listen for Auth Changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                mapUser(session.user);
                fetchOrders(session.user.id);
            } else {
                setUser(null);
                setActiveNumbers([]);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
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

    useEffect(() => {
        if (user) {
            fetchWallet();

            const channel = supabase
                .channel('wallet-changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
                    (payload) => {
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
                .subscribe((status) => {
                    console.log('App: Wallet subscription status', status);
                });

            return () => {
                supabase.removeChannel(channel);
            };
        }
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

                    // Status derived from payment_status column (synced from SMSPool server-side)
                    // SMSPool has 3 statuses: pending, completed, refunded
                    const ps = o.payment_status;
                    if (ps === 'completed') {
                        status = 'Completed';
                    } else if (ps === 'refunded') {
                        status = 'Refunded';
                    } else if (ps === 'failed' || ps === 'manual_intervention_required') {
                        status = 'Failed';
                    } else if (ps === 'cancelled') {
                        status = 'Expired';
                    } else {
                        // 'pending', 'paid', or any other status = still waiting
                        status = 'Pending';
                    }

                    const smsCode = o.sms_code || o.metadata?.sms_code;

                    return {
                        id: o.id,
                        number: o.metadata?.phonenumber || o.metadata?.number || (status === 'Pending' ? 'Processing...' : '---'),
                        country: o.metadata?.country || 'US',
                        service: o.service_type || 'Unknown',
                        status: status as any,
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
        await supabase.auth.signOut();
        setUser(null);
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
            balance,

            activeNumbers,
            transactions: [],
            isAuthenticated,
            loading,
            login,
            logout,
            addNumber,
            deductBalance,
            refreshNumbers,
            wallet,
            fetchWallet
        }}>
            {children}
        </AppContext.Provider>
    );
};
