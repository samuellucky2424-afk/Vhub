import React, { useState } from 'react';
import { useApp } from '../App';

const Profile: React.FC = () => {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'personal' | 'security' | 'notifications'>('personal');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
        setIsSaving(false);
        alert('Settings saved successfully!');
    }, 1000);
  };

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
                        onClick={() => setActiveTab('personal')}
                        className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 sm:flex-none px-6 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        {isSaving && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
                        {isSaving ? 'Saving...' : 'Save Changes'}
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
                             onClick={() => setActiveTab('security')}
                             className={`pb-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'security' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                        >
                            Security
                        </button>
                        <button 
                             onClick={() => setActiveTab('notifications')}
                             className={`pb-4 border-b-2 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'notifications' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                        >
                            Notifications
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

                    {activeTab === 'security' && (
                        <div className="lg:col-span-3 space-y-8 animate-in fade-in duration-500">
                             <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5">
                                    <h4 className="font-bold text-gray-900 dark:text-white">Password & Authentication</h4>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold">Two-Factor Authentication</p>
                                            <p className="text-sm text-gray-500">Add an extra layer of security to your account.</p>
                                        </div>
                                        <button className="px-4 py-2 bg-green-100 text-green-700 font-bold rounded-lg text-sm border border-green-200">Enabled</button>
                                    </div>
                                    <div className="border-t border-gray-100 dark:border-white/5 pt-6">
                                        <button className="text-primary font-bold text-sm hover:underline">Change Password</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="lg:col-span-3 space-y-8 animate-in fade-in duration-500">
                            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5">
                                    <h4 className="font-bold text-gray-900 dark:text-white">Notification Preferences</h4>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Email Alerts</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Receive weekly summaries</p>
                                        </div>
                                        <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                                            <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white transition transform"></span>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">SMS Notifications</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Receive alerts on your real phone</p>
                                        </div>
                                        <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-zinc-700 transition-colors focus:outline-none">
                                            <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition transform"></span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default Profile;
