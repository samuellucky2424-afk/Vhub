import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../src/lib/supabase';

interface Country {
    ID: number;
    name: string;
    short_name: string;
}

import SearchableSelect from '../../components/SearchableSelect';

interface Service {
    ID: number;
    name: string;
}

// Helper to get service icon
const getServiceIcon = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('whatsapp')) return 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg';
    if (lower.includes('telegram')) return 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg';
    if (lower.includes('google')) return 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg';
    if (lower.includes('facebook')) return 'https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg';
    if (lower.includes('instagram')) return 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg';
    if (lower.includes('tiktok')) return 'https://upload.wikimedia.org/wikipedia/commons/3/34/Ionic_Logo_ionic.svg'; // Placeholder or use specialized CDN
    if (lower.includes('uber')) return 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.png';
    // Add more as needed or use a generic service
    return ''; // Return empty to fall back to default icon
};

const CheckoutSummary: React.FC = () => {
    const navigate = useNavigate();

    const [countries, setCountries] = useState<Country[]>([]);
    const [services, setServices] = useState<Service[]>([]);

    const [selectedCountry, setSelectedCountry] = useState<string>('1'); // Default US (ID 1)
    const [selectedService, setSelectedService] = useState<string>('307'); // Default WhatsApp (ID 307 - varies, assume placeholder)

    const [price, setPrice] = useState<number>(0);
    const [priceNGN, setPriceNGN] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch Metadata on Mount
    useEffect(() => {
        const controller = new AbortController();
        const fetchMetadata = async () => {
            try {
                const { data, error } = await supabase.functions.invoke('smspool-metadata', {
                    headers: { 'x-client-info': 'vhub-web' }
                    // Note: supabase-js invoke doesn't support signal directly in all versions, 
                    // but we can at least catch the error if it bubbles up.
                });

                if (controller.signal.aborted) return;

                if (data) {
                    // Handle Countries
                    if (Array.isArray(data.countries)) {
                        const popular = data.countries.filter((c: any) => ['US', 'GB', 'FR', 'DE'].includes(c.short_name));
                        const others = data.countries.filter((c: any) => !['US', 'GB', 'FR', 'DE'].includes(c.short_name));
                        setCountries([...popular, ...others]);
                        if (data.countries.length > 0) setSelectedCountry(data.countries[0].ID.toString());
                    }

                    // Handle Services
                    if (Array.isArray(data.services)) {
                        setServices(data.services);

                        // Default service logic
                        const whatsapp = data.services.find((s: any) => s.name.toLowerCase().includes('whatsapp'));
                        if (whatsapp) setSelectedService(whatsapp.ID.toString());
                        else if (data.services.length > 0) setSelectedService(data.services[0].ID.toString());
                    }
                }
            } catch (err: any) {
                // Silent catch
            }
        };
        fetchMetadata();

        return () => controller.abort();
    }, []);

    // Fetch Price when Service changes
    useEffect(() => {
        let active = true;
        const fetchPrice = async () => {
            setIsLoading(true);
            setPriceNGN(0); // Reset price while loading
            setPrice(0);

            try {
                // Use direct fetch with Anon Key to avoid 401 issues with User Token
                const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smspool-service`;

                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        action: 'get_price',
                        country: selectedCountry,
                        service: selectedService,
                    })
                });

                if (!response.ok) {
                    console.error('Price fetch error:', response.status, response.statusText);
                    return;
                }

                const data = await response.json();
                const error = null;



                if (!active) return;

                if (data && data.final_ngn) {
                    setPriceNGN(data.final_ngn);
                    setPrice(0); // USD price not returned by backend anymore
                } else {
                    setPriceNGN(0);
                }
            } catch (err: any) {
                if (err.name === 'AbortError' || !active) {
                    // Ignore abort errors
                } else {
                    console.error("Unexpected error fetching price:", err);
                }
            } finally {
                if (active) setIsLoading(false);
            }
        };
        if (selectedCountry && selectedService) fetchPrice();

        return () => {
            active = false;
        };
    }, [selectedCountry, selectedService]);

    const handleProceed = () => {
        // Find names for display
        const countryName = countries.find(c => c.ID.toString() == selectedCountry)?.name || 'Unknown';
        const serviceName = services.find(s => s.ID.toString() == selectedService)?.name || 'Unknown';

        navigate('/checkout/payment', {
            state: {
                country: countryName,
                countryId: selectedCountry,
                service: serviceName,
                serviceId: selectedService,
                price: price, // USD Price
                amountNGN: priceNGN // NGN Total
            }
        });
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 w-full h-full overflow-y-auto">
            {/* Responsive Step Indicator */}
            <div className="flex items-center justify-center mb-10 md:mb-16">
                <div className="flex flex-col items-center relative z-10">
                    <div className="size-10 md:size-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-xl shadow-primary/30 ring-4 ring-white dark:ring-[#221c10]">1</div>
                    <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-primary whitespace-nowrap">Summary</span>
                </div>
                <div className="w-16 md:w-32 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mx-2 md:mx-4 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20"></div>
                </div>
                <div className="flex flex-col items-center relative z-10 opacity-50">
                    <div className="size-8 md:size-10 rounded-full bg-slate-100 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-sm md:text-base ring-4 ring-white dark:ring-[#221c10]">2</div>
                    <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-slate-400 whitespace-nowrap">Payment</span>
                </div>
                <div className="w-16 md:w-32 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mx-2 md:mx-4"></div>
                <div className="flex flex-col items-center relative z-10 opacity-50">
                    <div className="size-8 md:size-10 rounded-full bg-slate-100 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-sm md:text-base ring-4 ring-white dark:ring-[#221c10]">3</div>
                    <span className="absolute top-full mt-3 text-xs md:text-sm font-bold text-slate-400 whitespace-nowrap">Success</span>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
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
                            <SearchableSelect
                                label="Region"
                                options={countries.map(c => ({
                                    value: c.ID.toString(),
                                    label: c.name,
                                    iconUrl: `https://flagcdn.com/w40/${c.short_name.toLowerCase()}.png`,
                                    subtitle: 'Instant Delivery'
                                }))}
                                value={selectedCountry}
                                onChange={setSelectedCountry}
                                placeholder="Select Country..."
                                icon="public"
                            />

                            {/* Service Selector */}
                            <SearchableSelect
                                label="Service"
                                options={services.map(s => {
                                    const iconUrl = getServiceIcon(s.name);
                                    return {
                                        value: s.ID.toString(),
                                        label: s.name,
                                        iconUrl: iconUrl,
                                        icon: !iconUrl ? 'chat' : undefined, // Fallback icon char if no URL
                                        subtitle: 'High Availability'
                                    };
                                })}
                                value={selectedService}
                                onChange={setSelectedService}
                                placeholder="Select Service..."
                                icon="chat" // Trigger icon
                            />
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
                                    <span className="text-4xl font-black text-slate-900 dark:text-white">
                                        {isLoading ? '...' : `₦${priceNGN.toLocaleString()}`}
                                    </span>
                                    <span className="text-sm font-bold text-slate-400">NGN</span>
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
                            disabled={isLoading || priceNGN <= 0}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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