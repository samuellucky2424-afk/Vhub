import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
    url?: string;
}

const SEO: React.FC<SEOProps> = ({
    title,
    description,
    keywords,
    image,
    url
}) => {
    const siteTitle = 'V-Number - Virtual Numbers for SMS Verification';
    const fullTitle = title ? `${title} | V-Number` : siteTitle;

    const defaultDescription = 'Get instant virtual numbers for SMS verification from 100+ countries. Secure, private, and reliable service for WhatsApp, Telegram, Google, and more.';
    const metaDescription = description || defaultDescription;

    const defaultKeywords = 'virtual number, sms verification, temp number, fake number, number for whatsapp, online sms';
    const metaKeywords = keywords || defaultKeywords;

    const metaImage = image || 'https://v-number.global/og-image.png'; // Placeholder URL
    const metaUrl = url || 'https://v-number.global'; // Placeholder URL

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="title" content={fullTitle} />
            <meta name="description" content={metaDescription} />
            <meta name="keywords" content={metaKeywords} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={metaUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:image" content={metaImage} />

            {/* Twitter */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={metaUrl} />
            <meta property="twitter:title" content={fullTitle} />
            <meta property="twitter:description" content={metaDescription} />
            <meta property="twitter:image" content={metaImage} />
        </Helmet>
    );
};

export default SEO;
