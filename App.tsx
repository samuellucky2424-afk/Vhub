import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Context
import { AppProvider, useApp } from './src/context/AppContext';

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
import SupportPage from './pages/SupportPage';

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

// Exporting useApp here for backward compatibility if needed, 
// though imports should now come from context/AppContext
export { useApp };

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Inner App Component that uses the context
const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useApp() as any; // Cast if type mismatch initially

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
        <Route element={
          loading ? (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
              <div className="flex flex-col items-center gap-4">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                  <span className="material-symbols-outlined text-3xl">cell_tower</span>
                </div>
                <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          ) : isAuthenticated ? (
            <AuthenticatedLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/numbers" element={<ActiveNumbers />} />
          <Route path="/store" element={<Store />} />

          {/* Checkout Flow */}
          <Route path="/checkout/summary" element={<CheckoutSummary />} />
          <Route path="/checkout/payment" element={<CheckoutPayment />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/support" element={<SupportPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <HelmetProvider>
        <AppContent />
      </HelmetProvider>
    </AppProvider>
  );
};

export default App;