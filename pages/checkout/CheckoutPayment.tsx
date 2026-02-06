import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../App';

const CheckoutPayment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addNumber } = useApp();
  const [loading, setLoading] = useState(false);

  const { country, service, price } = location.state || { country: 'USA', service: 'WhatsApp', price: 15.95 };

  const handlePayment = () => {
    setLoading(true);
    setTimeout(() => {
        // Direct purchase logic
        addNumber({
            id: Date.now().toString(),
            number: `+1 555 ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
            country: country === 'USA' ? 'US' : 'UK',
            service: service,
            status: 'Active',
            expiresAt: '2024-01-01',
            logs: []
        });

        navigate('/checkout/success', { state: { service, price } });
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 flex flex-col h-full overflow-y-auto w-full">
         {/* Responsive Step Indicator */}
         <div className="flex items-center justify-center mb-12">
            {/* Step 1 - Completed */}
            <div className="flex flex-col items-center relative z-10 cursor-pointer" onClick={() => navigate('/checkout/summary')}>
                <div className="size-8 md:size-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-md ring-4 ring-white dark:ring-[#221c10]">
                    <span className="material-symbols-outlined text-lg">check</span>
                </div>
                <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-500 whitespace-nowrap">Summary</span>
            </div>

            {/* Connector - Full */}
            <div className="w-16 md:w-32 h-1 bg-emerald-500 rounded-full mx-2 md:mx-4"></div>

            {/* Step 2 - Active */}
            <div className="flex flex-col items-center relative z-10">
                <div className="size-10 md:size-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-xl shadow-primary/30 ring-4 ring-white dark:ring-[#221c10]">
                    2
                </div>
                <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-primary whitespace-nowrap">Payment</span>
            </div>

            {/* Connector - Empty */}
            <div className="w-16 md:w-32 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mx-2 md:mx-4 relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20"></div>
            </div>

            {/* Step 3 - Pending */}
            <div className="flex flex-col items-center relative z-10 opacity-50">
                <div className="size-8 md:size-10 rounded-full bg-slate-100 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-sm md:text-base ring-4 ring-white dark:ring-[#221c10]">
                    3
                </div>
                <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-slate-400 whitespace-nowrap">Success</span>
            </div>
        </div>

        <div className="flex flex-col gap-8">
            <div className="text-center">
                <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">Secure Checkout</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Review your order details and confirm payment.</p>
            </div>

             <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Order Details</h3>
                </div>
                <div className="p-6 md:p-8 flex flex-col gap-6">
                     <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm">
                         <div className="flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-2xl">
                                    {service === 'WhatsApp' ? 'chat' : 'public'}
                                </span>
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">{country} Number</p>
                                <p className="text-sm text-slate-500">{service} Verification</p>
                            </div>
                         </div>
                         <div className="font-black text-xl text-slate-900 dark:text-white">${price}</div>
                     </div>
                     
                     {/* Payment Method */}
                     <div className="space-y-3">
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Method</label>
                         <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-800/50 cursor-pointer hover:border-primary transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="bg-white dark:bg-black p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm">
                                    <span className="material-symbols-outlined text-slate-700 dark:text-slate-200">credit_card</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">My Wallet Balance</p>
                                    <p className="text-xs text-emerald-600 font-bold">Available: $24.50</p>
                                </div>
                            </div>
                            <div className="size-6 rounded-full border-2 border-primary flex items-center justify-center">
                                <div className="size-3 rounded-full bg-primary"></div>
                            </div>
                         </div>
                     </div>

                     <div className="border-t border-dashed border-slate-200 dark:border-zinc-700 pt-6 flex justify-between items-center">
                        <span className="text-lg font-bold text-slate-700 dark:text-slate-300">Total Amount</span>
                        <span className="text-3xl font-black text-primary">${price}</span>
                    </div>

                    <button 
                        onClick={handlePayment}
                        disabled={loading}
                        className={`w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-2 transition-all active:scale-[0.98] ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary/90'}`}
                    >
                        {loading ? (
                            <span className="material-symbols-outlined animate-spin">refresh</span>
                        ) : (
                            <>
                            <span className="material-symbols-outlined">lock</span>
                            Confirm & Pay
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-slate-400">By confirming, you agree to our Terms of Service.</p>
                </div>
             </div>
        </div>
    </div>
  );
};

export default CheckoutPayment;