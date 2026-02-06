import React from 'react';
import { useNavigate } from 'react-router-dom';

const PricingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
           <button onClick={() => navigate('/')} className="mb-6 text-sm font-bold text-gray-500 hover:text-primary">← Back to Home</button>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">Pay only for what you need. No hidden fees or long-term contracts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Starter */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all">
            <h3 className="text-xl font-bold mb-2">Starter</h3>
            <p className="text-sm text-gray-500 mb-6">Perfect for one-time verification</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black">$2.50</span>
              <span className="text-sm text-gray-500">/number</span>
            </div>
            <button onClick={() => navigate('/login')} className="w-full py-3 rounded-lg border-2 border-primary text-primary font-bold hover:bg-primary hover:text-white transition-colors mb-8">Get Started</button>
            <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>1 OTP Verification</li>
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>20 Minute Duration</li>
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>Standard Support</li>
            </ul>
          </div>

          {/* Pro */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border-2 border-primary shadow-xl relative scale-105 z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Most Popular</div>
            <h3 className="text-xl font-bold mb-2">Business</h3>
            <p className="text-sm text-gray-500 mb-6">For power users and teams</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black">$15.95</span>
              <span className="text-sm text-gray-500">/month</span>
            </div>
            <button onClick={() => navigate('/login')} className="w-full py-3 rounded-lg bg-primary text-white font-bold hover:bg-primary/90 transition-colors mb-8 shadow-lg shadow-primary/20">Start Free Trial</button>
            <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>10 Numbers / Month</li>
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>Unlimited SMS Receive</li>
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>Priority Support</li>
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>API Access</li>
            </ul>
          </div>

          {/* Enterprise */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all">
            <h3 className="text-xl font-bold mb-2">Enterprise</h3>
            <p className="text-sm text-gray-500 mb-6">Custom solutions for volume</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black">Custom</span>
            </div>
            <button onClick={() => navigate('/help')} className="w-full py-3 rounded-lg border border-gray-300 dark:border-zinc-700 font-bold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors mb-8">Contact Sales</button>
            <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>Unlimited Numbers</li>
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>Dedicated Account Manager</li>
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>SLA Guarantee</li>
              <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-500 text-lg">check</span>Custom Integration</li>
            </ul>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-gray-200 dark:border-zinc-800">
           <h2 className="text-2xl font-bold mb-4">Have questions?</h2>
           <p className="text-gray-500 mb-6">Check out our Help Center or contact our support team.</p>
           <button onClick={() => navigate('/help')} className="text-primary font-bold hover:underline">Visit Help Center →</button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;