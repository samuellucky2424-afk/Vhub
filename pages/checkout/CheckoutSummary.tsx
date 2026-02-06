import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CheckoutSummary: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCountry, setSelectedCountry] = useState('USA');
  const [selectedService, setSelectedService] = useState('WhatsApp');

  const PRICE = 15.95;

  const handleProceed = () => {
    // In a real app, dispatch to context
    navigate('/checkout/payment', { state: { country: selectedCountry, service: selectedService, price: PRICE } });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 w-full h-full overflow-y-auto">
      {/* Responsive Step Indicator */}
      <div className="flex items-center justify-center mb-10 md:mb-16">
        {/* Step 1 */}
        <div className="flex flex-col items-center relative z-10">
            <div className="size-10 md:size-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-xl shadow-primary/30 ring-4 ring-white dark:ring-[#221c10]">
                1
            </div>
            <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-primary whitespace-nowrap">Summary</span>
        </div>

        {/* Connector */}
        <div className="w-16 md:w-32 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mx-2 md:mx-4 relative overflow-hidden">
             <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20"></div>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col items-center relative z-10 opacity-50">
            <div className="size-8 md:size-10 rounded-full bg-slate-100 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-sm md:text-base ring-4 ring-white dark:ring-[#221c10]">
                2
            </div>
            <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-slate-400 whitespace-nowrap">Payment</span>
        </div>

        {/* Connector */}
        <div className="w-16 md:w-32 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mx-2 md:mx-4"></div>

        {/* Step 3 */}
        <div className="flex flex-col items-center relative z-10 opacity-50">
            <div className="size-8 md:size-10 rounded-full bg-slate-100 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-sm md:text-base ring-4 ring-white dark:ring-[#221c10]">
                3
            </div>
            <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-slate-400 whitespace-nowrap">Success</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Selection */}
        <div className="flex-1 space-y-6">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors font-medium px-1">
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Back to Dashboard
            </button>

            <section className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-900 dark:text-white">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                         <span className="material-symbols-outlined">tune</span>
                    </div>
                    Configure Order
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Country Selector */}
                    <div className="relative group">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Region</label>
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-zinc-800 hover:border-primary/50 transition-colors cursor-pointer relative overflow-hidden">
                             <span className="text-2xl">🇺🇸</span>
                             <div className="flex-1 min-w-0">
                                <select 
                                    value={selectedCountry}
                                    onChange={(e) => setSelectedCountry(e.target.value)}
                                    className="w-full bg-transparent font-bold text-slate-900 dark:text-white border-none p-0 focus:ring-0 cursor-pointer appearance-none relative z-10"
                                >
                                    <option value="USA">United States</option>
                                    <option value="UK">United Kingdom</option>
                                    <option value="FR">France</option>
                                </select>
                                <p className="text-xs text-slate-500 truncate">Instant Delivery</p>
                             </div>
                             <span className="material-symbols-outlined text-slate-400">expand_more</span>
                        </div>
                    </div>

                    {/* Service Selector */}
                    <div className="relative group">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Service</label>
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-zinc-800 hover:border-primary/50 transition-colors cursor-pointer relative overflow-hidden">
                            <div className="size-8 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                                 <span className="material-symbols-outlined text-sm">chat</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <select 
                                    value={selectedService}
                                    onChange={(e) => setSelectedService(e.target.value)}
                                    className="w-full bg-transparent font-bold text-slate-900 dark:text-white border-none p-0 focus:ring-0 cursor-pointer appearance-none relative z-10"
                                >
                                    <option value="WhatsApp">WhatsApp</option>
                                    <option value="Telegram">Telegram</option>
                                    <option value="Google">Google</option>
                                    <option value="Facebook">Facebook</option>
                                </select>
                                <p className="text-xs text-slate-500 truncate">High Availability</p>
                            </div>
                            <span className="material-symbols-outlined text-slate-400">expand_more</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        {/* Right Column: Summary */}
        <div className="w-full lg:w-[380px]">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border-2 border-primary/10 dark:border-primary/20 p-6 md:p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-400"></div>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-slate-900 dark:text-white">${PRICE}</span>
                            <span className="text-sm font-bold text-slate-400">USD</span>
                        </div>
                    </div>
                    <div className="bg-primary/10 text-primary p-2 rounded-lg">
                        <span className="material-symbols-outlined">receipt_long</span>
                    </div>
                </div>
                
                <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-black/20 p-3 rounded-lg">
                        <span className="material-symbols-outlined text-green-500">check_circle</span>
                        <span className="font-medium">Valid for 20 minutes</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-black/20 p-3 rounded-lg">
                        <span className="material-symbols-outlined text-green-500">check_circle</span>
                        <span className="font-medium">Guaranteed SMS delivery</span>
                    </div>
                </div>

                <button 
                    onClick={handleProceed}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
                >
                    Continue to Payment
                    <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>
                <p className="text-center text-[10px] text-slate-400 mt-4">Secured by 256-bit SSL encryption</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSummary;