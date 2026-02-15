import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { motion } from 'framer-motion';

const Dashboard: React.FC = () => {
  const { user, balance, totalSpent, activeNumbers } = useApp();
  const navigate = useNavigate();

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
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
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
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full px-4 py-1.5 flex items-center gap-2"
          >
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Balance</span>
            <span className="text-sm font-bold text-primary">${balance.toFixed(2)}</span>
          </motion.div>
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
                <h3 className="text-2xl font-bold tracking-tight">${totalSpent.toFixed(2)}</h3>
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
    </div>
  );
};

export default Dashboard;