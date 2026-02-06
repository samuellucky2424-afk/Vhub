import React, { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';

const ProductPage: React.FC = () => {
  const navigate = useNavigate();
  const { feature } = useParams();
  const ref = useRef(null);
  
  const { scrollYProgress } = useScroll({
      target: ref,
      offset: ["start start", "end start"]
  });

  const headerY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.5]);

  const isNumbers = feature === 'numbers';

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display pt-24 pb-12 overflow-hidden">
      <div ref={ref} className="max-w-7xl mx-auto px-6 relative">
         <motion.button 
            whileHover={{ x: -5 }}
            onClick={() => navigate('/')} 
            className="mb-6 text-sm font-bold text-gray-500 hover:text-primary flex items-center gap-1"
        >
            ← Back to Home
         </motion.button>
         
         <div className="flex flex-col md:flex-row items-center gap-12 mb-20 relative z-10">
            <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="flex-1"
            >
                <span className="text-primary font-bold uppercase tracking-widest text-sm mb-2 block">{isNumbers ? 'Global Coverage' : 'Instant Verification'}</span>
                <h1 className="text-4xl md:text-6xl font-black mb-6">{isNumbers ? 'Virtual Numbers for Everyone' : 'Secure OTP Verification'}</h1>
                <p className="text-xl text-gray-500 mb-8 leading-relaxed">
                    {isNumbers 
                        ? "Access phone numbers from over 100 countries without needing a physical SIM card. Perfect for travelers, businesses, and privacy-conscious individuals." 
                        : "Receive SMS verification codes instantly from services like WhatsApp, Telegram, Google, and thousands more. Bylass geo-restrictions and protect your identity."}
                </p>
                <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/login')} 
                    className="px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all"
                >
                    {isNumbers ? 'Browse Numbers' : 'Get Verified Now'}
                </motion.button>
            </motion.div>
            
            <motion.div 
                style={{ y: headerY, opacity: headerOpacity }}
                className="flex-1 w-full"
            >
                <div className="bg-gray-200 dark:bg-zinc-800 rounded-2xl h-96 w-full flex items-center justify-center relative overflow-hidden group">
                     {/* Abstract Visual */}
                     <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
                     <motion.span 
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
                        className="material-symbols-outlined text-9xl text-gray-400 dark:text-zinc-700 group-hover:scale-110 transition-transform duration-700"
                     >
                        {isNumbers ? 'public' : 'verified_user'}
                     </motion.span>
                </div>
            </motion.div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
                { icon: 'speed', title: 'Fastest Delivery', desc: 'Less than 500ms latency on message receipt.' },
                { icon: 'lock', title: 'Encrypted', desc: 'End-to-end encryption for all messages.' },
                { icon: 'savings', title: 'Low Cost', desc: 'Competitive pricing starting at just $0.50.' }
            ].map((item, i) => (
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className="p-8 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800"
                >
                    <span className="material-symbols-outlined text-4xl text-primary mb-4">{item.icon}</span>
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-gray-500">{item.desc}</p>
                </motion.div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default ProductPage;