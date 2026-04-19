/**
 * Format kobo amount as Nigerian Naira (₦).
 * Supabase stores wallet amounts in kobo (1 NGN = 100 kobo).
 * @param kobo - Amount in kobo (BIGINT from DB)
 * @returns Formatted Naira string, e.g. "₦1,702.00"
 */
export const formatNaira = (kobo: number): string => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
    }).format(kobo / 100);
};

/**
 * Convert kobo to naira (numeric).
 * @param kobo - Amount in kobo
 * @returns Amount in naira
 */
export const koboToNaira = (kobo: number): number => kobo / 100;

/**
 * Convert naira to kobo (numeric).
 * @param naira - Amount in naira
 * @returns Amount in kobo
 */
export const nairaToKobo = (naira: number): number => Math.round(naira * 100);
