import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FloatingSupportWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Floating Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-20 lg:bottom-6 left-4 z-50 size-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all cursor-pointer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Support"
            >
                <span className="material-symbols-outlined text-[24px]">
                    {isOpen ? 'close' : 'support_agent'}
                </span>
            </motion.button>

            {/* Support Popup */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-40"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.9 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed bottom-36 lg:bottom-20 left-4 z-50 w-72 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden"
                        >
                            <div className="bg-[#25D366] p-4 text-white">
                                <h3 className="font-bold text-base">Need Help?</h3>
                                <p className="text-sm opacity-90">We typically reply within minutes</p>
                            </div>
                            <div className="p-4 space-y-3">
                                <a
                                    href="https://wa.me/2348147133637"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3 px-4 rounded-xl transition-all text-sm"
                                >
                                    <span className="material-symbols-outlined text-xl">chat</span>
                                    Chat on WhatsApp
                                </a>
                                <a
                                    href="mailto:samuellucky242@hotmail.com"
                                    className="flex items-center gap-3 w-full bg-slate-800 hover:bg-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold py-3 px-4 rounded-xl transition-all text-sm"
                                >
                                    <span className="material-symbols-outlined text-xl">mail</span>
                                    Email Support
                                </a>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default FloatingSupportWidget;
