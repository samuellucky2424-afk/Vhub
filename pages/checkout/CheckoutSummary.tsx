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
    <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-12 w-full h-full overflow-y-auto">
      {/* Step Indicator */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-white font-bold">1</div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none">Summary</span>
            <span className="text-xs text-primary font-medium">Step 1 of 3</span>
          </div>
        </div>
        <div className="hidden md:block w-16 h-[2px] bg-[#e5e7eb] dark:bg-[#3d3421]"></div>
        <div className="flex items-center gap-3 opacity-50">
          <div className="flex size-10 items-center justify-center rounded-full border-2 border-[#e5e7eb] dark:border-[#3d3421] font-bold">2</div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none">Payment</span>
            <span className="text-xs">Upcoming</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Selection */}
        <div className="flex-1 space-y-6">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm text-[#897b61] hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Back to Dashboard
            </button>

            <section className="bg-white dark:bg-[#2b2416] p-6 rounded-xl border border-[#e5e7eb] dark:border-[#3d3421] shadow-sm">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">shopping_cart</span>
                    Service Selection
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Country Selector Mock */}
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-background-light dark:bg-background-dark/50 border border-[#e5e7eb] dark:border-[#3d3421]">
                         <div className="text-3xl">🇺🇸</div>
                         <div>
                            <p className="text-xs uppercase tracking-wider text-[#897b61] font-bold">Target Country</p>
                            <select 
                                value={selectedCountry}
                                onChange={(e) => setSelectedCountry(e.target.value)}
                                className="bg-transparent font-bold border-none p-0 focus:ring-0 cursor-pointer"
                            >
                                <option value="USA">United States (USA)</option>
                                <option value="UK">United Kingdom (UK)</option>
                                <option value="FR">France (FR)</option>
                            </select>
                            <p className="text-sm text-[#897b61]">Standard Regional Pool</p>
                         </div>
                    </div>

                    {/* Service Selector Mock */}
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-background-light dark:bg-background-dark/50 border border-[#e5e7eb] dark:border-[#3d3421]">
                        <div className="size-10 rounded-lg bg-[#25D366] flex items-center justify-center text-white">
                             <span className="material-symbols-outlined">chat</span>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wider text-[#897b61] font-bold">Service</p>
                            <select 
                                value={selectedService}
                                onChange={(e) => setSelectedService(e.target.value)}
                                className="bg-transparent font-bold border-none p-0 focus:ring-0 cursor-pointer"
                            >
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Telegram">Telegram</option>
                                <option value="Google">Google</option>
                            </select>
                            <p className="text-sm text-[#897b61]">Instant SMS Receipt</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        {/* Right Column: Summary */}
        <div className="w-full lg:w-[380px]">
            <div className="bg-white dark:bg-[#2b2416] rounded-xl border-2 border-primary p-6 shadow-xl">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Order Summary</p>
                <div className="mb-6">
                    <div className="flex items-end gap-1">
                        <span className="text-4xl font-black">${PRICE}</span>
                        <span className="text-sm font-medium text-[#897b61] mb-1">USD</span>
                    </div>
                    <p className="text-xs text-[#897b61] mt-2">One-time purchase for OTP verification.</p>
                </div>
                <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>Immediate Activation</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>Single-use OTP</span>
                    </div>
                </div>
                <button 
                    onClick={handleProceed}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
                >
                    Buy Now
                    <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSummary;