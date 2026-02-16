import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../src/lib/supabase';

// TypeScript declaration for Paystack
declare global {
  interface Window {
    PaystackPop: any;
  }
}

const Dashboard: React.FC = () => {
  const { user, balance, totalSpent, activeNumbers, fetchWallet } = useApp();
  const navigate = useNavigate();
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundingLoading, setFundingLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const handleFundWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(fundAmount);
    if (!amount || amount < 100) {
      alert('Minimum funding amount is ₦100');
      return;
    }

    setFundingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('initialize-wallet-funding', {
        body: { amount }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message || 'Failed to initialize payment');

      const reference = data.reference;
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error('Paystack public key not configured');
      }

      // Open Paystack inline popup
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: user?.email,
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        ref: reference,
        callback: async function (response: any) {
          console.log('Payment successful:', response);
          setFundingLoading(false);
          setVerifyingPayment(true);

          // Poll for transaction confirmation
          let attempts = 0;
          const maxAttempts = 20;

          const checkTransaction = async () => {
            const { data: txData } = await supabase
              .from('wallet_transactions')
              .select('id, amount')
              .eq('reference', reference)
              .maybeSingle();

            if (txData) {
              console.log('Transaction confirmed!', txData);
              await fetchWallet();
              setVerifyingPayment(false);
              setShowFundModal(false);
              setFundAmount('');
              alert(`Wallet funded successfully! ₦${amount} added to your balance.`);
            } else {
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(checkTransaction, 1500);
              } else {
                setVerifyingPayment(false);
                alert('Payment received but verification is taking longer than usual. Your balance will update shortly.');
                setShowFundModal(false);
              }
            }
          };

          checkTransaction();
        },
        onClose: function () {
          console.log('Payment popup closed');
          setFundingLoading(false);
          setVerifyingPayment(false);
        }
      });

      handler.openIframe();

    } catch (err: any) {
      console.error('Funding Error:', err);
      alert(err.message || 'Failed to initialize funding. Please try again.');
      setFundingLoading(false);
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto relative">
      {/* Header */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 md:px-8 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400">grid_view</span>
          <h2 className="text-xl font-bold">Overview</h2>
        </div>
        <div className="flex items-center gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFundModal(true)}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full px-4 py-1.5 flex items-center gap-2 hover:border-primary transition-colors cursor-pointer"
          >
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Balance</span>
            <span className="text-sm font-bold text-primary">₦{balance?.toLocaleString() || '0.00'}</span>
            <span className="material-symbols-outlined text-primary text-sm bg-primary/10 rounded-full p-0.5">add</span>
          </motion.button>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold leading-none">{user?.name}</p>
              <p className="text-[10px] text-slate-500 font-medium">{user?.plan} Plan</p>
            </div>
            <div className="size-10 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden border border-slate-200 dark:border-zinc-700">
              <img className="w-full h-full object-cover" src={user?.avatar} alt="Profile" />
            </div>
          </div>
        </div>
      </motion.header>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-8"
      >
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div variants={item} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="size-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">Total Spent</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold tracking-tight">₦{totalSpent?.toLocaleString() || '0.00'}</h3>
              </div>
            </div>
          </motion.div>
          <motion.div variants={item} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">history</span>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">History</p>
              <h3 className="text-2xl font-bold tracking-tight">{activeNumbers.length}</h3>
            </div>
          </motion.div>
          <motion.div variants={item} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="size-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined">forum</span>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">SMS Received</p>
              <h3 className="text-2xl font-bold tracking-tight">
                {activeNumbers.reduce((acc, curr) => acc + curr.logs.length, 0)}
              </h3>
            </div>
          </motion.div>
        </div>

        {/* Quick Purchase CTA */}
        <motion.div variants={item} className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/20">
            <h2 className="text-lg font-bold">Buy Verification Number</h2>
          </div>
          <div className="p-8 flex flex-col items-start gap-4">
            <p className="text-slate-600 dark:text-zinc-400">Get a temporary number for instant OTP verification from over 100 countries.</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/checkout/summary')}
              className="bg-primary hover:bg-primary/90 text-zinc-900 font-bold h-11 px-8 rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
              Buy Now
            </motion.button>
            <p className="text-xs text-slate-500 dark:text-zinc-500">Available for immediate activation. Credits will be deducted from your balance.</p>
          </div>
        </motion.div>

        {/* History Table */}
        <motion.div variants={item} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-bold tracking-tight">History</h2>
            <button onClick={() => navigate('/numbers')} className="text-sm font-semibold text-primary hover:underline">View all</button>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Service</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Number</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {activeNumbers.slice(0, 5).map((num) => {
                    // Find the latest code if available
                    const latestCode = num.logs.find(log => log.code)?.code;

                    return (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={num.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <span className="material-symbols-outlined text-lg">
                                {num.service === 'WhatsApp' ? 'chat' : num.service === 'Telegram' ? 'send' : 'public'}
                              </span>
                            </div>
                            <span className="text-sm font-semibold">{num.service}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-zinc-300">{num.number} ({num.country})</td>
                        <td className="px-6 py-4">
                          {latestCode ? (
                            <span className="inline-block bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2.5 py-1 rounded-md font-mono text-sm font-bold tracking-widest text-primary select-all">
                              {latestCode}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Waiting for SMS...</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${num.status === 'Active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            num.status === 'Pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                              num.status === 'Refunded' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                                num.status === 'Failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-slate-100 text-slate-600'
                            }`}>
                            {num.status}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {activeNumbers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-500">No history found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Fund Wallet Modal */}
      <AnimatePresence>
        {showFundModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFundModal(false)}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 m-auto z-50 w-full max-w-md h-fit p-4"
            >
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Fund Wallet</h3>
                  <button onClick={() => setShowFundModal(false)} className="size-8 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
                <div className="p-6">
                  <form onSubmit={handleFundWallet} className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Amount (₦)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                        <input
                          type="number"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(e.target.value)}
                          placeholder="e.g. 5000"
                          className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 pl-8 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          min="100"
                          required
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Minimum funding amount is ₦100.</p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex gap-3">
                      <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        {verifyingPayment
                          ? 'Payment successful! Verifying transaction...'
                          : 'A secure payment popup will open. Your wallet will be credited automatically upon success.'}
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={fundingLoading || verifyingPayment}
                      className="w-full bg-primary hover:bg-primary/90 text-zinc-900 font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {verifyingPayment ? (
                        <>
                          <span className="material-symbols-outlined animate-spin">refresh</span>
                          Verifying Payment...
                        </>
                      ) : fundingLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin">refresh</span>
                          Opening Payment...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">account_balance_wallet</span>
                          Proceed to Payment
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;