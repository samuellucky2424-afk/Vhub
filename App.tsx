import React, { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppContextType, VirtualNumber, User } from './types';
import { INITIAL_NUMBERS, MOCK_USER } from './constants';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import Dashboard from './pages/Dashboard';
import ActiveNumbers from './pages/ActiveNumbers';
import Store from './pages/Store';
import CheckoutSummary from './pages/checkout/CheckoutSummary';
import CheckoutPayment from './pages/checkout/CheckoutPayment';
import CheckoutSuccess from './pages/checkout/CheckoutSuccess';

// Footer Pages
import PricingPage from './pages/PricingPage';
import APIPage from './pages/APIPage';
import HelpPage from './pages/HelpPage';
import BlogPage from './pages/BlogPage';
import LegalPage from './pages/LegalPage';
import ProductPage from './pages/ProductPage';

// Layouts
import AuthenticatedLayout from './components/AuthenticatedLayout';
import { VerificationDisplay } from './src/components/VerificationDisplay';
import { supabase } from './src/lib/supabase';


const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeNumbers, setActiveNumbers] = useState<VirtualNumber[]>([]);
  const [balance, setBalance] = useState(0.00); // Balance is 0 as we use direct payments
  const [totalSpent, setTotalSpent] = useState(0.00);
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
      name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      email: authUser.email || '',
      avatar: authUser.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      plan: 'Free',
      memberSince: new Date(authUser.created_at).getFullYear().toString()
    });
  };

  const fetchOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        const mapped: VirtualNumber[] = data.map(o => {
          let status: 'Active' | 'Expired' | 'Completed' | 'Pending' | 'Failed' | 'Refunded' = 'Expired';

          // Check metadata for granular status first
          const poolStatus = o.metadata?.smspool_status;
          if (poolStatus === 'refunded' || poolStatus === 2 || poolStatus === 6) {
            status = 'Refunded';
          } else if (o.payment_status === 'paid') {
            status = o.metadata?.phonenumber ? 'Active' : 'Pending';
          } else if (o.payment_status === 'manual_intervention_required' || o.payment_status === 'failed') {
            status = 'Failed';
          } else if (o.payment_status === 'refunded') {
            status = 'Refunded';
          }

          return {
            id: o.id,
            number: o.metadata?.phonenumber || o.metadata?.number || (status === 'Pending' ? 'Processing...' : '---'),
            country: o.metadata?.country || 'US',
            service: o.service_type || 'Unknown',
            status: status as any, // Cast to match type definition or update type definition
            expiresAt: new Date(new Date(o.created_at).getTime() + 10 * 60 * 1000).toISOString(),
            logs: o.sms_code ? [{
              id: `${o.id}-log`,
              sender: o.service_type || 'Service',
              message: `Your verification code is ${o.sms_code}`,
              code: o.sms_code,
              receivedAt: new Date(o.created_at).toLocaleString(),
              isRead: false
            }] : []
          };
        });
        setActiveNumbers(mapped);

        // Calculate Total Spent
        const spent = data
          .filter(o => o.payment_status === 'paid')
          .reduce((sum, order) => sum + (Number(order.price_usd) || 0), 0);
        setTotalSpent(spent);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
            <span className="material-symbols-outlined text-3xl">cell_tower</span>
          </div>
          <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      user,
      balance,
      totalSpent,
      activeNumbers,
      transactions: [],
      isAuthenticated,
      login,
      logout,
      addNumber,
      deductBalance,
      refreshNumbers
    }}>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/test-verification" element={<VerificationDisplay orderId="test-preview-id" />} />

          {/* Footer / Info Routes */}
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/api" element={<APIPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/legal/:section" element={<LegalPage />} />
          <Route path="/product/:feature" element={<ProductPage />} />

          {/* Protected Routes */}
          <Route element={isAuthenticated ? <AuthenticatedLayout /> : <Navigate to="/login" replace />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/numbers" element={<ActiveNumbers />} />
            <Route path="/store" element={<Store />} />

            {/* Checkout Flow */}
            <Route path="/checkout/summary" element={<CheckoutSummary />} />
            <Route path="/checkout/payment" element={<CheckoutPayment />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AppContext.Provider>
  );
};

export default App;