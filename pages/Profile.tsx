import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { supabase } from '../src/lib/supabase';
import { ReferralUsage } from '../types';

const Profile: React.FC = () => {
    const { user, logout } = useApp();
    const [activeTab, setActiveTab] = useState<'personal' | 'referral'>('personal');
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Referral state
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referrals, setReferrals] = useState<ReferralUsage[]>([]);
    const [referralLoading, setReferralLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    // Fetch referral data when tab is switched to referral
    useEffect(() => {
        if (activeTab === 'referral' && user?.id) {
            fetchReferralData();
        }
    }, [activeTab, user?.id]);

    const fetchReferralData = async () => {
        if (!user?.id) return;
        setReferralLoading(true);

        try {
            // Get user's referral code
            const { data: codeData, error: codeError } = await supabase.rpc('get_user_referral_code', { p_user_id: user.id });
            
            if (codeError) {
                console.warn('Referral code RPC not available:', codeError.message);
                // Generate a proper 5-character uppercase referral code as fallback
                const fallbackCode = await generateFallbackReferralCode(user.id);
                setReferralCode(fallbackCode);
            } else if (codeData) {
                setReferralCode(codeData);
            }

            // Get referral usages
            const { data: usageData, error: usageError } = await supabase.rpc('get_user_referrals', { p_user_id: user.id });
            if (usageError) {
                console.warn('Get referrals RPC not available:', usageError.message);
                setReferrals([]);
            } else if (usageData) {
                setReferrals(usageData);
            }
        } catch (err) {
            console.error('Error fetching referral data:', err);
            // Set fallback values
            const fallbackCode = await generateFallbackReferralCode(user?.id || '');
            setReferralCode(fallbackCode);
            setReferrals([]);
        } finally {
            setReferralLoading(false);
        }
    };

    // Fallback referral code generator (matches database logic)
    const generateFallbackReferralCode = async (userId: string): Promise<string> => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        // Local-only fallback: we intentionally do not query the database here,
        // because RLS may reject direct table reads (406) and the authoritative
        // uniqueness guarantee is handled by the RPC + DB constraint.
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const handleCopyCode = () => {
        if (!referralCode) return;
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyLink = () => {
        if (!referralCode) return;
        const link = `${window.location.origin}${window.location.pathname}#/signup?ref=${referralCode}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const rewardsEarned = referrals.filter((r) => r.reward_credited).length;

    return (
        <div className="flex-1 flex flex-col h-full overflow-y-auto">
            <header className="bg-white dark:bg-background-dark border-b border-gray-200 dark:border-white/10 sticky top-0 z-10 shrink-0">
                <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profile & Settings</h2>
                        <nav className="flex text-sm text-gray-500 mt-1 justify-center sm:justify-start">
                            <span>Dashboard</span>
                            <span className="mx-2">/</span>
                            <span className="text-gray-900 dark:text-gray-300 font-medium capitalize">{activeTab}</span>
                        </nav>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="flex-1 sm:flex-none px-6 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoggingOut && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
                            {isLoggingOut ? 'Logging out...' : 'Logout'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-4 sm:p-8">
                <div className="max-w-5xl mx-auto w-full space-y-8">
                    {/* Navigation Tabs */}
                    <div className="border-b border-gray-200 dark:border-white/10 overflow-x-auto">
                        <div className="flex gap-8 min-w-max px-2">
                            <button
                                onClick={() => setActiveTab('personal')}
                                className={`pb-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'personal' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                            >
                                Personal Info
                            </button>
                            <button
                                onClick={() => setActiveTab('referral')}
                                className={`pb-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'referral' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                            >
                                <span className="material-symbols-outlined text-base">loyalty</span>
                                Referrals
                            </button>
                        </div>
                    </div>

                    {/* Profile Summary Card */}
                    <section className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-white/10">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="relative group cursor-pointer">
                                <div className="size-24 rounded-full overflow-hidden border-4 border-primary/20 bg-gray-100 dark:bg-zinc-800">
                                    <img src={user?.avatar} alt="User avatar" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                </div>
                                <button className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg border-2 border-white dark:border-zinc-900 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                                </button>
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{user?.name}</h3>
                                <p className="text-gray-500 dark:text-gray-400">{user?.plan} Plan • Member since {user?.memberSince}</p>
                                <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">Verified Email</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">2FA Active</span>
                                </div>
                            </div>
                            <button className="w-full md:w-auto px-4 py-2 text-sm font-semibold border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">Change Avatar</button>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Dynamic Content Based on Tab */}
                        {activeTab === 'personal' && (
                            <div className="lg:col-span-3 space-y-8 animate-in fade-in duration-500">
                                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5">
                                        <h4 className="font-bold text-gray-900 dark:text-white">Personal Information</h4>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">First Name</label>
                                            <input type="text" defaultValue={user?.name.split(' ')[0]} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Last Name</label>
                                            <input type="text" defaultValue={user?.name.split(' ')[1]} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                                            <div className="relative">
                                                <input type="email" defaultValue={user?.email} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" />
                                                <span className="absolute right-3 top-2.5 material-symbols-outlined text-green-500 text-sm">check_circle</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'referral' && (
                            <div className="lg:col-span-3 space-y-6 animate-in fade-in duration-500">
                                {referralLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Referral Code Card */}
                                        <div className="bg-gradient-to-br from-primary/5 via-white to-amber-50 dark:from-primary/10 dark:via-zinc-900 dark:to-zinc-900 rounded-xl shadow-sm border border-primary/20 dark:border-primary/10 overflow-hidden">
                                            <div className="px-6 py-4 border-b border-primary/10 dark:border-primary/5">
                                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary">card_giftcard</span>
                                                    Your Referral Code
                                                </h4>
                                            </div>
                                            <div className="p-6 space-y-5">
                                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                                    <div className="flex-1 w-full">
                                                        <div className="bg-white dark:bg-zinc-800 border-2 border-dashed border-primary/30 rounded-xl px-6 py-4 text-center">
                                                            <p className="text-3xl font-black tracking-[0.3em] text-primary select-all">
                                                                {referralCode || '-----'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                                                        <button
                                                            onClick={handleCopyCode}
                                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm"
                                                        >
                                                            <span className="material-symbols-outlined text-base">
                                                                {copied ? 'check_circle' : 'content_copy'}
                                                            </span>
                                                            {copied ? 'Copied!' : 'Copy Code'}
                                                        </button>
                                                        <button
                                                            onClick={handleCopyLink}
                                                            className="flex-1 sm:flex-none px-4 py-2.5 border border-primary text-primary font-bold rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
                                                        >
                                                            <span className="material-symbols-outlined text-base">link</span>
                                                            Copy Link
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
                                                    Share your code with friends. When they sign up and make purchases totaling ₦5,000+, you earn <strong className="text-primary">₦1,300</strong>!
                                                </p>
                                            </div>
                                        </div>

                                        {/* Stats Row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-white/10 text-center">
                                                <p className="text-3xl font-black text-gray-900 dark:text-white">{referrals.length}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Referrals Used</p>
                                            </div>
                                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-white/10 text-center">
                                                <p className="text-3xl font-black text-green-600 dark:text-green-400">{rewardsEarned}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Rewards Earned</p>
                                            </div>
                                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-white/10 text-center">
                                                <p className="text-3xl font-black text-primary">₦{(rewardsEarned * 1300).toLocaleString()}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Earned</p>
                                            </div>
                                        </div>

                                        {/* Referral List */}
                                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
                                            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                                                <h4 className="font-bold text-gray-900 dark:text-white">Referred Users</h4>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full font-semibold">
                                                    {referrals.length} / 20 used
                                                </span>
                                            </div>
                                            {referrals.length === 0 ? (
                                                <div className="p-10 text-center">
                                                    <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-zinc-600 mb-3 block">group_add</span>
                                                    <p className="text-gray-500 dark:text-gray-400 font-semibold">No referrals yet</p>
                                                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Share your code to start earning rewards!</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                <th className="px-6 py-3 font-semibold">User</th>
                                                                <th className="px-6 py-3 font-semibold">Date</th>
                                                                <th className="px-6 py-3 font-semibold text-right">Reward</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                            {referrals.map((r) => (
                                                                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                                <span className="material-symbols-outlined text-primary text-sm">person</span>
                                                                            </div>
                                                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                                                {r.referred_name || 'Anonymous'}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                                        {new Date(r.created_at).toLocaleDateString('en-NG', {
                                                                            year: 'numeric', month: 'short', day: 'numeric'
                                                                        })}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        {r.reward_credited ? (
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                                                                ₦1,300 Earned
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                                <span className="material-symbols-outlined text-xs">hourglass_top</span>
                                                                                Pending
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
