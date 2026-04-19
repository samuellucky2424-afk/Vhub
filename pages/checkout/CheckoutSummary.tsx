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

import { getServiceIconUrl as getServiceIcon } from '../../src/utils/serviceIcons';

const CheckoutSummary: React.FC = () => {
    const navigate = useNavigate();

    const [countries, setCountries] = useState<Country[]>([]);
    const [services, setServices] = useState<Service[]>([]);

    const [selectedCountry, setSelectedCountry] = useState<string>('');
    const [selectedService, setSelectedService] = useState<string>('');
    const [metadataLoaded, setMetadataLoaded] = useState(false);

    const [price, setPrice] = useState<number>(0);
    const [priceNGN, setPriceNGN] = useState<number>(0);
    const [serviceAvailable, setServiceAvailable] = useState<boolean>(true);
    const [availableStockCount, setAvailableStockCount] = useState<number>(0);
    const [stockCountKnown, setStockCountKnown] = useState<boolean>(false);
    const [availabilityMessage, setAvailabilityMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<string>('sms_pool');

    const providers = [
        { ID: 'sms_pool', name: 'Lite Service', icon: 'bolt', successRate: 60 },
        { ID: 'text_verify', name: 'Pro Service', icon: 'verified_user', successRate: 85 },
        { ID: 'sms_activate', name: 'Premium Service', icon: 'diamond', successRate: 73 }
    ];

    const currentProvider = providers.find(p => p.ID === selectedProvider) || providers[0];

    // Fetch Metadata on Mount
    useEffect(() => {
        const controller = new AbortController();
        const fetchMetadata = async () => {
            setIsLoading(true);
            setMetadataLoaded(false);
            setCountries([]); // Clear old lists
            setServices([]);
            setPriceNGN(0);
            try {
                console.log(`Fetching metadata for provider: ${selectedProvider}`);
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/textverify-service`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        'x-client-info': 'vhub-web'
                    },
                    body: JSON.stringify({ 
                        action: 'get_metadata',
                        provider: selectedProvider.toLowerCase().trim()
                    }),
                    signal: controller.signal
                });
                
                if (!response.ok) throw new Error('Failed to fetch metadata');
                const data = await response.json();

                if (controller.signal.aborted) return;

                if (data) {
                    // Only update state if this request matches the currently selected provider
                    if (selectedProvider.toLowerCase().trim() === data.provider?.toLowerCase().trim() || !data.provider) {
                        // Handle Area Codes (Countries Dropdown)
                        if (Array.isArray(data.countries)) {
                            setCountries(data.countries);
                            if (data.countries.length > 0) {
                                // Default to US if available, else first country
                                const us = data.countries.find((c: any) => c.short_name === 'US' || c.ID.toString() === '1');
                                setSelectedCountry(us ? us.ID.toString() : data.countries[0].ID.toString());
                            } else {
                                setSelectedCountry('');
                            }
                        }

                        // Handle Services
                        if (Array.isArray(data.services)) {
                            setServices(data.services);

                            // Default service logic
                            const whatsapp = data.services.find((s: any) => s.name.toLowerCase().includes('whatsapp'));
                            if (whatsapp) setSelectedService(whatsapp.ID.toString());
                            else if (data.services.length > 0) setSelectedService(data.services[0].ID.toString());
                            else setSelectedService('');
                        }
                    }
                    setMetadataLoaded(true);
                }
            } catch (err: any) {
                if (err.name === 'AbortError') return; // Ignore expected aborts
                console.error("Metadata fetch error:", err);
                setMetadataLoaded(true);
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };
        fetchMetadata();

        return () => controller.abort();
    }, [selectedProvider]);

    // Fetch Price when Service changes
    useEffect(() => {
        let active = true;
        const fetchPrice = async () => {
            setIsLoading(true);
            setPriceNGN(0); // Reset price while loading
            setPrice(0);
            setServiceAvailable(true);
            setAvailableStockCount(0);
            setStockCountKnown(false);
            setAvailabilityMessage('');

            try {
                // Prevent fetching price if we don't have valid selections for the current provider
                if (!selectedCountry || !selectedService || !metadataLoaded) {
                    setIsLoading(false);
                    return;
                }

                console.log(`Fetching price for ${selectedProvider}: ${selectedService} in ${selectedCountry}`);
                
                // Use direct fetch with Anon Key to avoid 401 issues with User Token
                const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/textverify-service`;

                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        action: 'get_price',
                        provider: selectedProvider.toLowerCase().trim(),
                        country: selectedCountry,
                        service: selectedService,
                        service_name: services.find(s => s.ID.toString() == selectedService)?.name || undefined
                    })
                });

                const rawText = await response.text();
                let data: any = null;

                if (rawText) {
                    try {
                        data = JSON.parse(rawText);
                    } catch {
                        throw new Error(`Invalid get_price response (${response.status}): ${rawText}`);
                    }
                }

                if (!active) return;

                const nextStockCount = Number(data?.stock_count ?? data?.available_pool_count ?? 0);
                const hasKnownStockCount = typeof data?.stock_count !== 'undefined' || typeof data?.available_pool_count !== 'undefined';

                if (!response.ok) {
                    console.error('Price fetch error:', response.status, data?.message || data?.error || response.statusText);
                    setServiceAvailable(false);
                    setAvailableStockCount(hasKnownStockCount ? nextStockCount : 0);
                    setStockCountKnown(hasKnownStockCount);
                    setAvailabilityMessage(data?.message || data?.error || 'Unable to fetch price right now.');
                    return;
                }

                if (data?.available === false) {
                    setServiceAvailable(false);
                    setAvailableStockCount(nextStockCount);
                    setStockCountKnown(hasKnownStockCount);
                    setAvailabilityMessage(data.message || 'Selected country and service are currently out of stock.');
                    setPriceNGN(0);
                } else if (data && data.final_ngn) {
                    setServiceAvailable(true);
                    setAvailableStockCount(nextStockCount);
                    setStockCountKnown(hasKnownStockCount);
                    setAvailabilityMessage('');
                    setPriceNGN(data.final_ngn);
                    setPrice(0); // USD price not returned by backend anymore
                } else {
                    setServiceAvailable(false);
                    setAvailableStockCount(0);
                    setStockCountKnown(false);
                    setAvailabilityMessage('Price not available for the selected country or service.');
                    setPriceNGN(0);
                }
            } catch (err: any) {
                if (err.name === 'AbortError' || !active) {
                    // Ignore abort errors
                } else {
                    console.error("Unexpected error fetching price:", err);
                    if (active) {
                        setServiceAvailable(false);
                        setAvailableStockCount(0);
                        setStockCountKnown(false);
                        setAvailabilityMessage(err.message || 'Unable to fetch price right now.');
                    }
                }
            } finally {
                if (active) setIsLoading(false);
            }
        };
        if (metadataLoaded && selectedCountry && selectedService) fetchPrice();

        return () => {
            active = false;
        };
    }, [metadataLoaded, selectedCountry, selectedService, services, selectedProvider]);

    const handleProceed = () => {
        if (!serviceAvailable || priceNGN <= 0) return;

        const countryName = countries.find(c => c.ID.toString() == selectedCountry)?.name || 'Unknown';
        const serviceName = services.find(s => s.ID.toString() == selectedService)?.name || 'Unknown';

        navigate('/checkout/payment', {
            state: {
                provider: selectedProvider,
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
        <div className="max-w-4xl mx-auto px-3 py-4 md:py-8 w-full h-full overflow-y-auto">
            {/* Compact Step Indicator */}
            <div className="flex items-center justify-center mb-6 md:mb-10 scale-90 md:scale-100">
                <div className="flex flex-col items-center relative z-10">
                    <div className="size-8 md:size-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-lg shadow-primary/30 ring-2 ring-white dark:ring-[#221c10]">1</div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-primary whitespace-nowrap">Configure</span>
                </div>
                <div className="w-12 md:w-24 h-0.5 bg-slate-100 dark:bg-zinc-800 mx-2 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-primary/20"></div>
                </div>
                <div className="flex flex-col items-center relative z-10 opacity-50">
                    <div className="size-7 md:size-9 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-xs md:text-sm ring-2 ring-white dark:ring-[#221c10]">2</div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-slate-400 whitespace-nowrap">Payment</span>
                </div>
                <div className="w-12 md:w-24 h-0.5 bg-slate-100 dark:bg-zinc-800 mx-2"></div>
                <div className="flex flex-col items-center relative z-10 opacity-50">
                    <div className="size-7 md:size-9 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 flex items-center justify-center font-bold text-xs md:text-sm ring-2 ring-white dark:ring-[#221c10]">3</div>
                    <span className="absolute top-full mt-2 text-[10px] md:text-xs font-bold text-slate-400 whitespace-nowrap">Success</span>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors font-medium px-1">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Dashboard
                </button>

                {/* Configuration Section */}
                <section className="bg-white dark:bg-zinc-900 p-4 md:p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Provider Selector */}
                        <SearchableSelect
                            label="Provider"
                            options={providers.map(p => ({
                                value: p.ID,
                                label: p.name,
                                icon: p.icon,
                                subtitle: `Success Rate: ${p.successRate}%`
                            }))}
                            value={selectedProvider}
                            onChange={setSelectedProvider}
                            placeholder="Select Provider..."
                            icon="hub"
                        />

                        {/* Country Selector */}
                        <SearchableSelect
                            label="Country"
                            options={countries.map(c => ({
                                value: c.ID.toString(),
                                label: c.name,
                                iconUrl: `https://flagcdn.com/w40/${c.short_name.toLowerCase()}.png`,
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
                                    iconUrl: iconUrl || undefined,
                                };
                            })}
                            value={selectedService}
                            onChange={setSelectedService}
                            placeholder="Select Service..."
                            icon="chat"
                        />
                    </div>
                </section>

                {/* Summary Table - Redesigned like the sketch */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr className="border-b border-slate-100 dark:border-zinc-800">
                                    <td className="p-3 md:p-4 bg-slate-50/50 dark:bg-zinc-800/30 w-1/3 md:w-1/4">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm text-slate-400">pin</span>
                                            <span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-400">Number</span>
                                        </div>
                                    </td>
                                    <td className="p-3 md:p-4">
                                        <span className="text-xs md:text-sm font-mono text-slate-400">Available after purchase</span>
                                    </td>
                                </tr>
                                <tr className="border-b border-slate-100 dark:border-zinc-800">
                                    <td className="p-3 md:p-4 bg-slate-50/50 dark:bg-zinc-800/30">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm text-slate-400">payments</span>
                                            <span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-400">Price</span>
                                        </div>
                                    </td>
                                    <td className="p-3 md:p-4">
                                        <span className="text-sm md:text-lg font-black text-slate-900 dark:text-white">
                                            {isLoading ? '...' : serviceAvailable ? `₦${priceNGN.toLocaleString()}` : 'N/A'}
                                        </span>
                                    </td>
                                </tr>
                                <tr className="border-b border-slate-100 dark:border-zinc-800">
                                    <td className="p-3 md:p-4 bg-slate-50/50 dark:bg-zinc-800/30">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm text-slate-400">inventory_2</span>
                                            <span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-400">Stock</span>
                                        </div>
                                    </td>
                                    <td className="p-3 md:p-4">
                                        <span className={`text-xs md:text-sm font-bold ${serviceAvailable ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {isLoading ? '...' : stockCountKnown ? availableStockCount.toLocaleString() : 'Check Price'}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 md:p-4 bg-slate-50/50 dark:bg-zinc-800/30">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm text-slate-400">trending_up</span>
                                            <span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-400">Success Rate</span>
                                        </div>
                                    </td>
                                    <td className="p-3 md:p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 md:w-24 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${currentProvider.successRate}%` }}></div>
                                            </div>
                                            <span className="text-xs md:text-sm font-bold text-slate-500">{currentProvider.successRate}%</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Error/Notice Message */}
                {(!isLoading && !serviceAvailable) && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                            {availabilityMessage || 'Out of stock.'}
                        </p>
                    </div>
                )}

                {/* Compact Action Button */}
                <button
                    onClick={handleProceed}
                    disabled={isLoading || priceNGN <= 0 || !serviceAvailable}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 md:py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base mt-2"
                >
                    Continue to Payment
                    <span className="material-symbols-outlined text-base md:text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>

                <p className="text-center text-[10px] text-slate-400">Secured transaction • Encrypted connection</p>
            </div>
        </div>
    );
};

export default CheckoutSummary;
