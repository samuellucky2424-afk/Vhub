import React from 'react';
import { useNavigate } from 'react-router-dom';

const HelpPage: React.FC = () => {
  const navigate = useNavigate();

  const categories = [
    { icon: 'start', title: 'Getting Started', desc: 'Account setup, first purchase, and activation.' },
    { icon: 'payments', title: 'Billing & Payments', desc: 'Invoices, payment methods, and refunds.' },
    { icon: 'troubleshoot', title: 'Troubleshooting', desc: 'SMS not received, connection issues.' },
    { icon: 'security', title: 'Security & Privacy', desc: '2FA, data protection, and account safety.' },
  ];

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <div className="bg-primary px-6 pt-32 pb-20 text-center">
         <h1 className="text-4xl font-black text-white mb-6">How can we help you?</h1>
         <div className="max-w-2xl mx-auto relative">
            <input 
                type="text" 
                placeholder="Search for articles, guides, and more..." 
                className="w-full pl-12 pr-4 py-4 rounded-xl shadow-xl border-none focus:ring-4 focus:ring-white/30 text-lg"
            />
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-2xl">search</span>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
         <button onClick={() => navigate('/')} className="mb-8 text-sm font-bold text-gray-500 hover:text-primary">← Back to Home</button>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {categories.map((cat, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer">
                    <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined">{cat.icon}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-2">{cat.title}</h3>
                    <p className="text-sm text-gray-500">{cat.desc}</p>
                </div>
            ))}
         </div>

         <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-gray-200 dark:border-zinc-800">
            <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
                {[
                    "How long does a number last?",
                    "Can I get a refund if I don't receive an SMS?",
                    "Do you support recurring subscriptions?",
                    "Is my payment information secure?"
                ].map((q, i) => (
                    <div key={i} className="border-b border-gray-100 dark:border-zinc-800 pb-4 last:border-0 last:pb-0">
                        <button className="flex items-center justify-between w-full text-left font-medium hover:text-primary transition-colors">
                            {q}
                            <span className="material-symbols-outlined text-gray-400">expand_more</span>
                        </button>
                    </div>
                ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default HelpPage;