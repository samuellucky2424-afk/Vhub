import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Store: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const services = [
    {
        id: 1,
        name: "E-commerce Website",
        description: "Scale your sales with a robust online store fully integrated with virtual number APIs.",
        price: 1499,
        icon: "shopping_cart",
        popular: true,
        needsWarning: false
    },
    {
        id: 2,
        name: "Portfolio Website",
        description: "Showcase your professional work or agency with a sleek, responsive design.",
        price: 799,
        icon: "brush",
        popular: false,
        needsWarning: false
    }
  ];

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    service.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBuy = (serviceName: string, price: number) => {
      // Navigate to checkout with prepopulated values
      navigate('/checkout/summary', { state: { service: serviceName, price } });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between whitespace-nowrap border-b border-solid border-b-gray-200 dark:border-b-white/10 px-6 py-3 bg-white dark:bg-background-dark sticky top-0 z-10 shrink-0 gap-4">
        <h2 className="text-[#181511] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">Website Store</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
             <div className="flex w-full sm:w-64 items-stretch rounded-lg h-10 overflow-hidden border border-gray-200 dark:border-white/10">
                <div className="text-gray-400 bg-gray-50 dark:bg-white/5 flex items-center justify-center pl-4">
                    <span className="material-symbols-outlined">search</span>
                </div>
                <input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input flex w-full min-w-0 flex-1 border-none bg-gray-50 dark:bg-white/5 text-[#181511] dark:text-white focus:ring-0 placeholder:text-gray-400 pl-2 text-sm outline-none" 
                    placeholder="Search services..." 
                />
            </div>
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-xl">shopping_bag</span>
                My Orders
            </button>
        </div>
      </header>
      
      <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full">
         {/* Store Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map(service => (
                <div key={service.id} className="group bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden hover:shadow-xl hover:border-primary/50 transition-all flex flex-col">
                    <div className="h-48 bg-gray-100 dark:bg-white/5 relative overflow-hidden flex items-center justify-center">
                        <span className="material-symbols-outlined text-6xl text-primary/40 group-hover:scale-110 transition-transform">{service.icon}</span>
                        {service.popular && (
                            <div className="absolute top-3 right-3 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">Popular</div>
                        )}
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                        <h3 className="text-xl font-bold mb-2">{service.name}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-3 flex-1">{service.description}</p>
                        {service.needsWarning && (
                            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                    <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
                                    If the number doesn't work on WhatsApp, you can purchase another number or get a refund to your wallet.
                                </p>
                            </div>
                        )}
                        <div className="flex items-center justify-between mt-6">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-400 uppercase font-bold tracking-tighter">Starts at</span>
                                <span className="text-lg font-black">${service.price.toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={() => handleBuy(service.name, service.price)}
                                className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                Buy Now
                            </button>
                        </div>
                    </div>
                </div>
            ))}
            {filteredServices.length === 0 && (
                <div className="col-span-full py-20 text-center">
                    <p className="text-gray-400">No services found matching "{searchTerm}"</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Store;
