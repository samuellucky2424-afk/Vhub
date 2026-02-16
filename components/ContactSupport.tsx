import React from 'react';

const ContactSupport: React.FC = () => {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Contact Support</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                If you encounter any issues with your purchase or verification code, our support team is here to help.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <a
                    href="https://wa.me/2348147133637"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg group"
                >
                    <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">chat</span>
                    <span>Chat on WhatsApp</span>
                </a>
                <a
                    href="mailto:samuellucky242@hotmail.com"
                    className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg group"
                >
                    <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">mail</span>
                    <span>Email Support</span>
                </a>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-500/20 rounded-xl p-6 text-sm text-gray-700 dark:text-gray-300 space-y-4">
                <h3 className="font-bold text-orange-800 dark:text-orange-400 text-base mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">info</span>
                    Important Policy Information
                </h3>

                <p>
                    <span className="font-bold text-slate-900 dark:text-slate-200">Processing Errors:</span> If you do not receive a code for the number you purchased, please request another code for the same service.
                </p>

                <div className="mb-4">
                    <span className="font-bold text-slate-900 dark:text-slate-200">Refund Policy (24 Hours):</span> If you have not received a code after 24 hours, please contact support immediately for a refund. You must provide your:
                    <ul className="list-disc list-inside mt-2 ml-2 space-y-1 text-gray-600 dark:text-gray-400">
                        <li>Payment Reference ID</li>
                        <li>Amount Paid</li>
                        <li>Phone Number Purchased</li>
                    </ul>
                </div>

                <p>
                    <span className="font-bold text-slate-900 dark:text-slate-200">Report Issues:</span> If you encounter any error, please report it immediately to the support center so we can solve the issue. Your feedback helps us enhance the website.
                </p>

                <p>
                    <span className="font-bold text-slate-900 dark:text-slate-200">Pricing:</span> Each number's price depends on the country. If you find a number too expensive, please report it to the center for further assistance.
                </p>

                <p className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800/30 font-medium italic text-orange-800 dark:text-orange-400">
                    "I really appreciate you for using this website." — Lucky
                </p>
            </div>
        </div>
    );
};

export default ContactSupport;
