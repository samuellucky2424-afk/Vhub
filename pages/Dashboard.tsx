import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../src/lib/supabase';
import PaystackFunding from '../src/components/PaystackFunding';
import { ServiceLogo } from '../src/utils/serviceIcons';
import { formatNaira } from '../src/utils/formatCurrency';

const Dashboard: React.FC = () => {
  const { user, balance, activeNumbers, wallet } = useApp();
  const navigate = useNavigate();
  const [showFundModal, setShowFundModal] = useState(false);

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
            <span className="text-sm font-bold text-primary">{formatNaira(wallet?.balance_kobo ?? 0)}</span>
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
        className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6"
      >
        {/* Stats Row — 3 equal columns */}
        <div className="grid grid-cols-2 gap-2 md:gap-6">

          <motion.div variants={item} className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col items-center text-center md:flex-row md:text-left gap-2 md:gap-4 hover:shadow-md transition-shadow">
            <div className="size-9 md:size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px] md:text-[24px]">history</span>
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-zinc-400 font-medium">History</p>
              <h3 className="text-sm md:text-2xl font-bold tracking-tight">{activeNumbers.length}</h3>
            </div>
          </motion.div>
          <motion.div variants={item} className="bg-white dark:bg-zinc-900 p-3 md:p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col items-center text-center md:flex-row md:text-left gap-2 md:gap-4 hover:shadow-md transition-shadow">
            <div className="size-9 md:size-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px] md:text-[24px]">forum</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-zinc-400 font-medium">SMS Recv'd</p>
              <h3 className="text-sm md:text-2xl font-bold tracking-tight">
                {activeNumbers.reduce((acc, curr) => acc + curr.logs.length, 0)}
              </h3>
            </div>
          </motion.div>
        </div>

        {/* Buy Verification Number — side-by-side CTA + History */}
        <motion.div variants={item}>
          <h2 className="text-lg md:text-xl font-bold mb-3">Buy Verification Number</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buy Now CTA */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 flex flex-col justify-between">
              <div className="mb-4">
                <p className="text-slate-600 dark:text-zinc-400 text-sm mb-1">Get a temporary number for instant OTP verification from 100+ countries.</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500">Credits deducted from your wallet balance.</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/checkout/summary')}
                className="w-full bg-primary hover:bg-primary/90 text-zinc-900 font-bold h-12 rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                Buy Now
              </motion.button>
            </div>

            {/* Compact History */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/20">
                <h3 className="text-sm font-bold">Recent History</h3>
                <button onClick={() => navigate('/numbers')} className="text-xs font-semibold text-primary hover:underline">View all</button>
              </div>
              <div className="flex-1 divide-y divide-slate-100 dark:divide-zinc-800 overflow-y-auto max-h-[220px]">
                {activeNumbers.slice(0, 4).map((num) => {
                  const latestCode = num.logs.find(log => log.code)?.code;
                  return (
                    <div key={num.id} className="px-4 py-3 flex items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <ServiceLogo serviceName={num.service} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{num.service}</p>
                          <p className="text-[10px] text-slate-400 truncate">{num.number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {latestCode && latestCode !== 'PENDING' ? (
                          <span className="bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2 py-0.5 rounded font-mono text-xs font-bold tracking-wider text-primary">
                            {latestCode}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${num.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            num.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              num.status === 'Refunded' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                'bg-slate-100 text-slate-500'
                            }`}>
                            {num.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {activeNumbers.length === 0 && (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm">
                    <span className="material-symbols-outlined text-2xl mb-1 block opacity-40">inbox</span>
                    No history yet
                  </div>
                )}
              </div>
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
              <div className="relative">
                <button
                  onClick={() => setShowFundModal(false)}
                  className="absolute top-4 right-4 z-10 size-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
                <PaystackFunding />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;