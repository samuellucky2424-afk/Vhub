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
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col h-full overflow-y-auto w-full">
         <div className="flex items-center gap-3 pb-8 justify-center">
            <div className="flex items-center gap-2 text-slate-400 font-medium">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>Selection</span>
            </div>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2 text-primary text-sm font-bold">
                <span className="flex items-center justify-center size-5 bg-primary text-white rounded-full text-[10px]">2</span>
                <span>Payment</span>
            </div>
            <span className="text-slate-300">/</span>
             <div className="flex items-center gap-2 text-slate-400 font-medium">
                <span className="flex items-center justify-center size-5 bg-slate-200 rounded-full text-[10px]">3</span>
                <span>Confirmation</span>
            </div>
        </div>

        <div className="flex flex-col gap-6">
            <div className="text-center mb-4">
                <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">Secure Checkout</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Review your order details and confirm payment.</p>
            </div>

             <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg">Order Summary</h3>
                </div>
                <div className="p-6 flex flex-col gap-4">
                     <div className="flex gap-4 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                         <div className="size-12 rounded bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-2xl">chat</span>
                         </div>
                         <div>
                            <p className="font-bold text-sm">{country} Number</p>
                            <p className="text-xs text-slate-500">{service}</p>
                         </div>
                         <div className="ml-auto font-bold">${price}</div>
                     </div>
                     
                     {/* Placeholder for stored payment method visualization */}
                     <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-zinc-800/20">
                        <div className="flex items-center gap-3">
                            <div className="bg-white dark:bg-black p-1 rounded border border-slate-200 dark:border-slate-700">
                                <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">credit_card</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold">Payment Method</p>
                                <p className="text-xs text-slate-500">Secure Processing</p>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-green-500">lock</span>
                     </div>

                     <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center">
                        <span className="text-lg font-bold">Total Amount</span>
                        <span className="text-2xl font-black text-primary">${price}</span>
                    </div>

                    <button 
                        onClick={handlePayment}
                        disabled={loading}
                        className={`w-full bg-primary text-white font-black py-4 rounded-lg shadow-lg flex items-center justify-center gap-2 mt-4 transition-all active:scale-[0.98] ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary/90'}`}
                    >
                        {loading ? (
                            <span className="material-symbols-outlined animate-spin">refresh</span>
                        ) : (
                            <>
                            <span className="material-symbols-outlined">verified</span>
                            Confirm Purchase
                            </>
                        )}
                    </button>
                </div>
             </div>
        </div>
    </div>
  );
};

export default CheckoutPayment;