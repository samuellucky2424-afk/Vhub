import React from 'react';

/**
 * Maps service names to their official logo URLs.
 * Uses Simple Icons CDN for SVG logos, with Wikipedia fallbacks for common services.
 */

// Direct high-quality logo URLs for popular services (using Wikipedia SVGs for reliability)
const LOGO_MAP: Record<string, string> = {
    // Messaging
    'whatsapp': 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
    'telegram': 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg',
    'discord': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Discord_Logo.svg',
    'signal': 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Signal-Logo.svg',
    'viber': 'https://upload.wikimedia.org/wikipedia/commons/d/df/Viber_logo.svg',
    'line': 'https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg',
    'wechat': 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Wechat_logo.svg',
    'kakaotalk': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/KakaoTalk_logo.svg',

    // Social Media
    'facebook': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg',
    'instagram': 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg',
    'tiktok': 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
    'twitter': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg',
    'x': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg',
    'snapchat': 'https://upload.wikimedia.org/wikipedia/en/c/c4/Snapchat_logo.svg',
    'reddit': 'https://upload.wikimedia.org/wikipedia/en/5/58/Reddit_logo_new.svg',
    'pinterest': 'https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png',
    'threads': 'https://upload.wikimedia.org/wikipedia/commons/d/db/Threads_%28app%29.png',
    'linkedin': 'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png',

    // Google
    'google': 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
    'gmail': 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
    'youtube': 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg',

    // Tech & Cloud
    'microsoft': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
    'apple': 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    'yahoo': 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Yahoo%21_%282019%29.svg',
    'openai': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg',
    'chatgpt': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg',
    'steam': 'https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg',
    'epicgames': 'https://upload.wikimedia.org/wikipedia/commons/3/31/Epic_Games_logo.svg',
    'twitch': 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Twitch_Glitch_Logo_Purple.svg',

    // Finance & Services
    'paypal': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
    'uber': 'https://upload.wikimedia.org/wikipedia/commons/5/58/Uber_logo_2018.svg',
    'lyft': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Lyft_logo.svg',
    'airbnb': 'https://upload.wikimedia.org/wikipedia/commons/6/69/Airbnb_Logo_B%C3%A9lo.svg',
    'netflix': 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Logonetflix.png',
    'spotify': 'https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg',
    'tinder': 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Tinder_-_app_logo.png',
    'bumble': 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Logo-bumble.svg',
    'hinge': '',

    // Shopping
    'aliexpress': 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Aliexpress_logo.svg',
    'ebay': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg',
    'shopify': 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopify_logo_2018.svg',
    'walmart': 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Walmart_logo.svg',

    // Other
    'binance': 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Binance_Logo.svg',
    'coinbase': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Coinbase.svg',
    'dropbox': 'https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg',
    'slack': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
    'zoom': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Zoom_Logo_2022.svg',
    'skype': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Skype_logo_%282019%E2%80%93present%29.svg',
    'bolt': '',
    'grab': 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Grab_Logo.svg',
    'didi': '',
    'wish': '',
    'nike': 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg',

    // Additional services commonly found on SMSPool
    'douyin': 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
    'tiktok/douyin': 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
    'match': '',
    'pof': '',
    '1688': '',
    'alibaba': 'https://upload.wikimedia.org/wikipedia/commons/9/96/Alibaba_Group_Logo.svg',
    'taobao': '',
    'other': '',
};

/**
 * Get logos URL for a service name. Tries exact match, then partial match.
 */
export const getServiceIconUrl = (serviceName: string): string => {
    if (!serviceName) return '';

    const lower = serviceName.toLowerCase().trim();

    // 1. Exact match
    if (LOGO_MAP[lower]) return LOGO_MAP[lower];

    // 2. Partial match (e.g. "WhatsApp Business" matches "whatsapp")
    for (const [key, url] of Object.entries(LOGO_MAP)) {
        if (lower.includes(key) || key.includes(lower)) {
            return url;
        }
    }

    // 3. No match — return empty to use material icon fallback
    return '';
};

// Re-export for backward compatibility
export const getServiceIcon = getServiceIconUrl;
export const getServiceIconWithFallback = getServiceIconUrl;

/**
 * Reusable ServiceLogo component — shows app logo with material icon fallback
 */
interface ServiceLogoProps {
    serviceName: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'size-6',
    md: 'size-8',
    lg: 'size-10',
};

const containerClasses = {
    sm: 'size-7 rounded-md',
    md: 'size-9 rounded-lg',
    lg: 'size-11 rounded-xl',
};

const iconSizes = {
    sm: 'text-[14px]',
    md: 'text-[18px]',
    lg: 'text-[22px]',
};

export const ServiceLogo: React.FC<ServiceLogoProps> = ({ serviceName, size = 'md', className = '' }) => {
    const iconUrl = getServiceIconUrl(serviceName);
    const [imgError, setImgError] = React.useState(false);

    // Reset error state when service changes
    React.useEffect(() => { setImgError(false); }, [serviceName]);

    if (iconUrl && !imgError) {
        return (
            <div className={`${containerClasses[size]} bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
                <img
                    src={iconUrl}
                    alt={serviceName}
                    className={`${sizeClasses[size]} object-contain p-0.5`}
                    onError={() => setImgError(true)}
                    loading="lazy"
                />
            </div>
        );
    }

    // Fallback: material icon
    return (
        <div className={`${containerClasses[size]} bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 flex items-center justify-center shrink-0 ${className}`}>
            <span className={`material-symbols-outlined ${iconSizes[size]}`}>verified_user</span>
        </div>
    );
};

export const FallbackIcon = ({ className }: { className?: string }) => (
    <div className={`flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded-full ${className}`}>
        <span className="material-symbols-outlined text-slate-500">lock</span>
    </div>
);
