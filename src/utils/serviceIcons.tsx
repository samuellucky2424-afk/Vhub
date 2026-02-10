export const getServiceIcon = (serviceName: string) => {
    // Normalization map for common services to ensure we get the right icon
    const normalization: Record<string, string> = {
        'google': 'google',
        'gmail': 'google',
        'youtube': 'youtube',
        'whatsapp': 'whatsapp',
        'telegram': 'telegram',
        'facebook': 'facebook',
        'instagram': 'instagram',
        'tiktok': 'tiktok',
        'twitter': 'twitter',
        'x': 'twitter',
        'discord': 'discord',
        'uber': 'uber',
        'netflix': 'netflix',
        'amazon': 'amazon',
        'linkedin': 'linkedin',
        'snapchat': 'snapchat',
        'openai': 'openai',
        'chatgpt': 'openai',
        'microsoft': 'microsoft',
        'apple': 'apple',
        'airbnb': 'airbnb',
        'yahoo': 'yahoo',
        'paypal': 'paypal',
        'tinder': 'tinder',
    };

    const normalized = normalization[serviceName.toLowerCase()] || serviceName.toLowerCase();

    // Use Simple Icons via CDN (jsdelivr) or Clearbit as fallback
    // Simple Icons is great for SVGs, Clearbit for general logos

    // We can try to return a specialized URL
    // Using simpleicons.org CDN for high quality SVGs
    // Format: https://cdn.simpleicons.org/[slug]/[color] (optional color)
    // We'll stick to default color

    return `https://cdn.simpleicons.org/${normalized}`;
};

export const getServiceIconWithFallback = (serviceName: string) => {
    // Return a function or object that keeps track of error state if used in generic img tag?
    // Actually simplicity is better - return standard URL, handle onError in component
    return getServiceIcon(serviceName);
};

export const FallbackIcon = ({ className }: { className?: string }) => (
    <div className={`flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded-full ${className}`}>
        <span className="material-symbols-outlined text-slate-500" > lock </span>
    </div>
);
