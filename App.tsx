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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState(24.50);
  const [activeNumbers, setActiveNumbers] = useState<VirtualNumber[]>(INITIAL_NUMBERS);

  const login = (userData?: Partial<User>) => {
    setIsAuthenticated(true);
    if (userData) {
        setUser({ ...MOCK_USER, ...userData } as User);
    } else {
        setUser(MOCK_USER as any);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  const addNumber = (newNumber: VirtualNumber) => {
    setActiveNumbers([newNumber, ...activeNumbers]);
  };

  const deductBalance = (amount: number) => {
    setBalance(prev => Math.max(0, prev - amount));
  };

  return (
    <AppContext.Provider value={{ 
      user, 
      balance, 
      activeNumbers, 
      transactions: [], 
      isAuthenticated,
      login,
      logout,
      addNumber,
      deductBalance
    }}>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          
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