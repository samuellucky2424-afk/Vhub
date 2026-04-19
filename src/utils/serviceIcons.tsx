import React from 'react';

interface ServiceIconDefinition {
    slug?: string;
    brandColor: string;
    monogram?: string;
}

const SERVICE_ICON_MAP: Record<string, ServiceIconDefinition> = {
    whatsapp: { slug: 'whatsapp', brandColor: '#25D366', monogram: 'WA' },
    telegram: { slug: 'telegram', brandColor: '#26A5E4', monogram: 'TG' },
    discord: { slug: 'discord', brandColor: '#5865F2', monogram: 'DC' },
    signal: { slug: 'signal', brandColor: '#3A76F0', monogram: 'SG' },
    viber: { slug: 'viber', brandColor: '#7360F2', monogram: 'VB' },
    line: { slug: 'line', brandColor: '#06C755', monogram: 'LN' },
    wechat: { slug: 'wechat', brandColor: '#07C160', monogram: 'WC' },
    kakaotalk: { slug: 'kakaotalk', brandColor: '#FEE500', monogram: 'KK' },

    facebook: { slug: 'facebook', brandColor: '#1877F2', monogram: 'FB' },
    instagram: { slug: 'instagram', brandColor: '#E4405F', monogram: 'IG' },
    tiktok: { slug: 'tiktok', brandColor: '#000000', monogram: 'TT' },
    x: { slug: 'x', brandColor: '#111111', monogram: 'X' },
    snapchat: { slug: 'snapchat', brandColor: '#FFFC00', monogram: 'SC' },
    reddit: { slug: 'reddit', brandColor: '#FF4500', monogram: 'RD' },
    pinterest: { slug: 'pinterest', brandColor: '#BD081C', monogram: 'PN' },
    threads: { slug: 'threads', brandColor: '#111111', monogram: 'TH' },
    linkedin: { slug: 'linkedin', brandColor: '#0A66C2', monogram: 'IN' },

    google: { slug: 'google', brandColor: '#4285F4', monogram: 'G' },
    gmail: { slug: 'gmail', brandColor: '#EA4335', monogram: 'GM' },
    youtube: { slug: 'youtube', brandColor: '#FF0000', monogram: 'YT' },

    microsoft: { slug: 'microsoft', brandColor: '#5E5E5E', monogram: 'MS' },
    apple: { slug: 'apple', brandColor: '#111111', monogram: 'AP' },
    amazon: { slug: 'amazon', brandColor: '#FF9900', monogram: 'AM' },
    yahoo: { slug: 'yahoo', brandColor: '#6001D2', monogram: 'YH' },
    openai: { slug: 'openai', brandColor: '#111111', monogram: 'AI' },
    steam: { slug: 'steam', brandColor: '#171A21', monogram: 'ST' },
    epicgames: { slug: 'epicgames', brandColor: '#313131', monogram: 'EG' },
    twitch: { slug: 'twitch', brandColor: '#9146FF', monogram: 'TW' },

    paypal: { slug: 'paypal', brandColor: '#003087', monogram: 'PP' },
    uber: { slug: 'uber', brandColor: '#111111', monogram: 'UB' },
    lyft: { slug: 'lyft', brandColor: '#FF00BF', monogram: 'LF' },
    airbnb: { slug: 'airbnb', brandColor: '#FF5A5F', monogram: 'AB' },
    netflix: { slug: 'netflix', brandColor: '#E50914', monogram: 'NF' },
    spotify: { slug: 'spotify', brandColor: '#1ED760', monogram: 'SP' },
    tinder: { slug: 'tinder', brandColor: '#FF6B6B', monogram: 'TD' },
    bumble: { slug: 'bumble', brandColor: '#FBBF24', monogram: 'BM' },
    hinge: { slug: 'hinge', brandColor: '#111111', monogram: 'HG' },

    aliexpress: { slug: 'aliexpress', brandColor: '#E62E04', monogram: 'AE' },
    ebay: { slug: 'ebay', brandColor: '#E53238', monogram: 'EB' },
    shopify: { slug: 'shopify', brandColor: '#7AB55C', monogram: 'SH' },
    walmart: { slug: 'walmart', brandColor: '#0071CE', monogram: 'WM' },

    binance: { slug: 'binance', brandColor: '#F3BA2F', monogram: 'BN' },
    coinbase: { slug: 'coinbase', brandColor: '#0052FF', monogram: 'CB' },
    dropbox: { slug: 'dropbox', brandColor: '#0061FF', monogram: 'DB' },
    slack: { slug: 'slack', brandColor: '#4A154B', monogram: 'SL' },
    zoom: { slug: 'zoom', brandColor: '#0B5CFF', monogram: 'ZM' },
    skype: { slug: 'skype', brandColor: '#00AFF0', monogram: 'SK' },
    bolt: { slug: 'bolt', brandColor: '#32D74B', monogram: 'BT' },
    grab: { slug: 'grab', brandColor: '#00B14F', monogram: 'GR' },
    didi: { brandColor: '#FF6A00', monogram: 'DD' },
    wish: { brandColor: '#2F4FEE', monogram: 'WS' },
    nike: { slug: 'nike', brandColor: '#111111', monogram: 'NK' },

    douyin: { slug: 'tiktok', brandColor: '#000000', monogram: 'DY' },
    match: { brandColor: '#FF5B5B', monogram: 'MT' },
    pof: { brandColor: '#2563EB', monogram: 'PO' },
    alibaba: { slug: 'alibaba', brandColor: '#FF6A00', monogram: 'AB' },
    taobao: { slug: 'taobao', brandColor: '#FF5000', monogram: 'TB' },
};

const SERVICE_MATCHERS: Array<[string, keyof typeof SERVICE_ICON_MAP]> = [
    ['whatsappbusiness', 'whatsapp'],
    ['whatsapp', 'whatsapp'],
    ['instagramthreads', 'threads'],
    ['threads', 'threads'],
    ['instagram', 'instagram'],
    ['telegram', 'telegram'],
    ['discord', 'discord'],
    ['signal', 'signal'],
    ['viber', 'viber'],
    ['wechat', 'wechat'],
    ['kakaotalk', 'kakaotalk'],
    ['kakao', 'kakaotalk'],
    ['line', 'line'],
    ['facebookmessenger', 'facebook'],
    ['facebook', 'facebook'],
    ['messenger', 'facebook'],
    ['tiktok', 'tiktok'],
    ['douyin', 'douyin'],
    ['twitter', 'x'],
    ['snapchat', 'snapchat'],
    ['reddit', 'reddit'],
    ['pinterest', 'pinterest'],
    ['linkedin', 'linkedin'],
    ['gmail', 'gmail'],
    ['googlevoice', 'google'],
    ['google', 'google'],
    ['youtube', 'youtube'],
    ['microsoft', 'microsoft'],
    ['apple', 'apple'],
    ['amazon', 'amazon'],
    ['yahoo', 'yahoo'],
    ['chatgpt', 'openai'],
    ['openai', 'openai'],
    ['steam', 'steam'],
    ['epicgames', 'epicgames'],
    ['epic', 'epicgames'],
    ['twitch', 'twitch'],
    ['paypal', 'paypal'],
    ['uber', 'uber'],
    ['lyft', 'lyft'],
    ['airbnb', 'airbnb'],
    ['netflix', 'netflix'],
    ['spotify', 'spotify'],
    ['tinder', 'tinder'],
    ['bumble', 'bumble'],
    ['hinge', 'hinge'],
    ['aliexpress', 'aliexpress'],
    ['ebay', 'ebay'],
    ['shopify', 'shopify'],
    ['walmart', 'walmart'],
    ['binance', 'binance'],
    ['coinbase', 'coinbase'],
    ['dropbox', 'dropbox'],
    ['slack', 'slack'],
    ['zoom', 'zoom'],
    ['skype', 'skype'],
    ['bolt', 'bolt'],
    ['grab', 'grab'],
    ['didi', 'didi'],
    ['wish', 'wish'],
    ['nike', 'nike'],
    ['match', 'match'],
    ['plentyoffish', 'pof'],
    ['pof', 'pof'],
    ['alibaba', 'alibaba'],
    ['taobao', 'taobao'],
];

const FALLBACK_COLOR = '#475569';

const normalizeServiceName = (serviceName: string): string =>
    serviceName
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');

const getServiceIconKey = (serviceName: string): keyof typeof SERVICE_ICON_MAP | null => {
    if (!serviceName) return null;

    const normalized = normalizeServiceName(serviceName);
    if (!normalized) return null;

    if (normalized in SERVICE_ICON_MAP) {
        return normalized as keyof typeof SERVICE_ICON_MAP;
    }

    for (const [token, key] of SERVICE_MATCHERS) {
        if (normalized.includes(token)) {
            return key;
        }
    }

    if (normalized === 'x') {
        return 'x';
    }

    return null;
};

const getInitialsFromName = (serviceName: string): string => {
    const cleaned = serviceName
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim();

    if (!cleaned) return '?';

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
    }

    return cleaned.replace(/\s+/g, '').slice(0, 2).toUpperCase();
};

const getServiceDefinition = (serviceName: string): ServiceIconDefinition | null => {
    const key = getServiceIconKey(serviceName);
    return key ? SERVICE_ICON_MAP[key] : null;
};

export const getServiceIconUrl = (serviceName: string): string => {
    const definition = getServiceDefinition(serviceName);
    return definition?.slug ? `https://cdn.simpleicons.org/${definition.slug}` : '';
};

export const getServiceBrandColor = (serviceName: string): string =>
    getServiceDefinition(serviceName)?.brandColor || FALLBACK_COLOR;

export const getServiceInitials = (serviceName: string): string =>
    getServiceDefinition(serviceName)?.monogram || getInitialsFromName(serviceName);

export const getServiceIcon = getServiceIconUrl;
export const getServiceIconWithFallback = getServiceIconUrl;

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

const fallbackTextClasses = {
    sm: 'text-[10px]',
    md: 'text-[11px]',
    lg: 'text-[13px]',
};

export const ServiceLogo: React.FC<ServiceLogoProps> = ({ serviceName, size = 'md', className = '' }) => {
    const iconUrl = getServiceIconUrl(serviceName);
    const brandColor = getServiceBrandColor(serviceName);
    const initials = getServiceInitials(serviceName);
    const [imgError, setImgError] = React.useState(false);

    React.useEffect(() => {
        setImgError(false);
    }, [serviceName]);

    if (iconUrl && !imgError) {
        return (
            <div className={`${containerClasses[size]} bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-black/5 ${className}`}>
                <img
                    src={iconUrl}
                    alt={serviceName}
                    className={`${sizeClasses[size]} object-contain p-1`}
                    onError={() => setImgError(true)}
                    loading="lazy"
                />
            </div>
        );
    }

    return (
        <div
            className={`${containerClasses[size]} flex items-center justify-center shrink-0 overflow-hidden ${className}`}
            style={{ backgroundColor: brandColor }}
            aria-label={serviceName}
        >
            <span className={`font-black tracking-[0.08em] text-white ${fallbackTextClasses[size]}`}>
                {initials}
            </span>
        </div>
    );
};

export const FallbackIcon = ({ className }: { className?: string }) => (
    <div className={`flex items-center justify-center bg-slate-100 dark:bg-zinc-800 rounded-full ${className}`}>
        <span className="material-symbols-outlined text-slate-500">lock</span>
    </div>
);
