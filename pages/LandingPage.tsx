import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import SEO from '../components/SEO';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Parallax Logic
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"]
  });

  const heroTextY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const heroImageY = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const countries = [
    { code: 'us', name: 'United States' },
    { code: 'gb', name: 'United Kingdom' },
    { code: 'ca', name: 'Canada' },
    { code: 'de', name: 'Germany' },
    { code: 'jp', name: 'Japan' },
    { code: 'au', name: 'Australia' },
    { code: 'fr', name: 'France' },
    { code: 'br', name: 'Brazil' },
  ];

  // Stagger variants for list animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pt-16 font-display">
      <SEO
        title="Home"
        description="Get instant virtual numbers for SMS verification from 100+ countries. Secure, private, and reliable service."
      />
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 z-50 w-full bg-white/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-[#181511]/5 dark:border-white/5"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
            <motion.div
              whileHover={{ rotate: 15 }}
              className="bg-primary p-1.5 rounded-lg text-white"
            >
              <span className="material-symbols-outlined block">cell_tower</span>
            </motion.div>
            <h2 className="text-xl font-extrabold tracking-tight">V-Number</h2>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('/product/numbers')} className="text-sm font-semibold hover:text-primary transition-colors bg-transparent border-none">Numbers</button>
            <button onClick={() => navigate('/product/verification')} className="text-sm font-semibold hover:text-primary transition-colors bg-transparent border-none">Features</button>
            <button onClick={() => navigate('/pricing')} className="text-sm font-semibold hover:text-primary transition-colors bg-transparent border-none">Pricing</button>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              Login
            </button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/signup')}
              className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:brightness-110 transition-all shadow-sm shadow-primary/20"
            >
              Sign Up
            </motion.button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-gray-600 dark:text-gray-300"
            onClick={toggleMenu}
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-[#1f1a12] border-b border-gray-100 dark:border-white/5 p-4 flex flex-col gap-4 shadow-xl"
          >
            <button onClick={() => navigate('/product/numbers')} className="text-left py-2 font-semibold hover:text-primary">Numbers</button>
            <button onClick={() => navigate('/product/verification')} className="text-left py-2 font-semibold hover:text-primary">Features</button>
            <button onClick={() => navigate('/pricing')} className="text-left py-2 font-semibold hover:text-primary">Pricing</button>
            <hr className="border-gray-100 dark:border-white/5" />
            <button
              onClick={() => navigate('/login')}
              className="w-full text-center font-bold px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-white/10"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full text-center bg-primary text-white font-bold px-5 py-3 rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-md"
            >
              Sign Up
            </button>
          </motion.div>
        )}
      </motion.header>

      {/* Hero Section with Parallax */}
      <section ref={targetRef} className="bg-primary px-6 py-12 md:py-24 relative overflow-hidden min-h-[90vh] flex items-center">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

        {/* Animated Background Elements */}
        <motion.div
          style={{ y: heroTextY, opacity }}
          className="absolute top-20 left-10 text-white/5 text-[10rem] font-black select-none pointer-events-none"
        >
          GLOBAL
        </motion.div>
        <motion.div
          style={{ y: heroImageY, opacity }}
          className="absolute bottom-10 right-10 text-white/5 text-[10rem] font-black select-none pointer-events-none"
        >
          CONNECT
        </motion.div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10 relative">
          <motion.div
            style={{ y: heroTextY }}
            className="text-center lg:text-left"
          >
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-6"
            >
              Global Reach • Instant Access
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-white text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tight mb-6"
            >
              Your Global Identity, <br /> Simplified.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-white/90 text-lg font-medium mb-8 max-w-xl mx-auto lg:mx-0"
            >
              Secure, private, and instant international numbers for SMS verification and business calls. Trusted by 50,000+ users worldwide.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0px 5px 15px rgba(0,0,0,0.2)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/signup')}
                className="bg-white text-primary text-lg font-bold px-8 py-4 rounded-xl shadow-xl transition-all"
              >
                Get Your Number
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/product/numbers')}
                className="bg-primary border-2 border-white/30 text-white text-lg font-bold px-8 py-4 rounded-xl transition-all"
              >
                View Coverage
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div
            style={{ y: heroImageY }}
            initial={{ opacity: 0, x: 100, rotate: 10 }}
            animate={{ opacity: 1, x: 0, rotate: 2 }}
            transition={{ type: "spring", stiffness: 50, delay: 0.4 }}
            className="relative hidden md:block"
          >
            {/* Hero Image */}
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-8 border-white/10 max-w-md mx-auto transform hover:rotate-0 transition-transform duration-500 cursor-pointer">
              <img
                src="https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&q=80&w=800"
                alt="V-Number App Interface"
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

              {/* Notification Popup Animation */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.2, type: "spring" }}
                className="absolute bottom-6 left-6 right-6 text-white"
              >
                <div className="flex items-center gap-3 mb-2 bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/20">
                  <div className="size-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined">check</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Verification Success</p>
                    <p className="text-xs text-white/80">Just now • WhatsApp</p>
                  </div>
                </div>
              </motion.div>
            </div>
            {/* Decorative blob */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-white/20 rounded-full blur-3xl -z-10"
            ></motion.div>
          </motion.div>
        </div>
      </section>

      {/* Description / Features Section */}
      <section className="py-24 px-6 bg-background-light dark:bg-background-dark relative z-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-black mb-4 text-slate-900 dark:text-white">Why choose V-Number?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">We provide the most reliable infrastructure for your digital identity needs, ensuring privacy and speed.</p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              { icon: 'bolt', title: 'Instant Activation', desc: 'Get your number immediately after purchase. No waiting times, no physical SIM cards required.' },
              { icon: 'lock', title: 'Private & Secure', desc: 'Your data is encrypted. Use numbers without revealing your personal identity or location.' },
              { icon: 'public', title: 'Global Coverage', desc: 'Access numbers from over 100 countries including US, UK, Europe, and Asia.' }
            ].map((feature, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ y: -10, transition: { type: "spring", stiffness: 300 } }}
                className="bg-white dark:bg-white/5 p-8 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-shadow"
              >
                <div className="size-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-3xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Country Flags Section with Scroll Reveal */}
      <section className="py-20 px-6 bg-white dark:bg-[#1a150d] relative overflow-hidden">
        {/* Background Parallax Decoration */}
        <motion.div
          style={{ y: useTransform(scrollYProgress, [0, 1], [0, -200]) }}
          className="absolute top-0 right-0 text-slate-100 dark:text-white/5 text-[20rem] font-bold leading-none -z-10 pointer-events-none opacity-50"
        >
          100+
        </motion.div>

        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 text-center md:text-left">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-black mb-2 text-slate-900 dark:text-white">100+ Countries Available</h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Instantly activate numbers from any of these popular regions.</p>
            </motion.div>
            <motion.button
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              onClick={() => navigate('/product/numbers')}
              className="flex items-center gap-2 text-primary font-bold group self-center md:self-auto hover:underline"
            >
              Explore all countries <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </motion.button>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4"
          >
            {countries.map((country) => (
              <motion.div
                key={country.code}
                variants={itemVariants}
                whileHover={{ scale: 1.05, borderColor: "rgba(236, 160, 19, 0.5)" }}
                className="flex flex-col items-center p-4 rounded-xl bg-background-light dark:bg-white/5 border border-black/5 dark:border-white/5 transition-colors cursor-pointer group"
              >
                <div className="size-12 rounded-full overflow-hidden mb-3 border border-gray-200 dark:border-gray-700 shadow-sm relative">
                  <img
                    src={`https://flagcdn.com/w160/${country.code}.png`}
                    alt={country.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">{country.name}</p>
                <p className="text-xs text-green-600 font-bold mt-1">Available</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Expanded Horizontal Footer with Slide Up Effect */}
      <motion.footer
        initial={{ opacity: 0, y: 100 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="bg-gray-50 dark:bg-background-dark pt-16 pb-12 px-6 border-t border-gray-200 dark:border-white/5"
      >
        <div className="max-w-7xl mx-auto">
          {/* Main Footer Row */}
          <div className="flex flex-col md:flex-row justify-between gap-12 mb-16">

            {/* Brand Column */}
            <div className="w-full md:w-1/4">
              <div className="flex items-center gap-2 mb-6">
                <div className="bg-primary p-1.5 rounded-lg text-white">
                  <span className="material-symbols-outlined block text-sm">cell_tower</span>
                </div>
                <h2 className="text-lg font-extrabold tracking-tight">V-Number</h2>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed mb-6 pr-4">
                Providing secure virtual numbers for businesses and individuals worldwide. Protect your privacy with V-Number.
              </p>
              <div className="flex gap-3">
                <Link to="/help" className="size-9 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm">
                  <span className="material-symbols-outlined text-lg">public</span>
                </Link>
                <Link to="/help" className="size-9 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm">
                  <span className="material-symbols-outlined text-lg">mail</span>
                </Link>
                <Link to="/help" className="size-9 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm">
                  <span className="material-symbols-outlined text-lg">chat</span>
                </Link>
              </div>
            </div>

            {/* Horizontal Links Container */}
            <div className="flex-1 flex flex-col sm:flex-row gap-8 sm:gap-16 lg:justify-end">

              {/* Product */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  Product
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: 16 }}
                    className="h-0.5 bg-primary rounded-full"
                  ></motion.div>
                </h4>
                <ul className="space-y-3 text-sm text-gray-500">
                  <li><Link to="/product/numbers" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Virtual Numbers</Link></li>
                  <li><Link to="/product/verification" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Verification</Link></li>
                  <li><Link to="/pricing" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Pricing</Link></li>
                  <li><Link to="/api" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>API Access</Link></li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  Resources
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: 16 }}
                    className="h-0.5 bg-primary rounded-full"
                  ></motion.div>
                </h4>
                <ul className="space-y-3 text-sm text-gray-500">
                  <li><Link to="/help" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Help Center</Link></li>
                  <li><Link to="/api" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Documentation</Link></li>
                  <li><Link to="/blog" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Blog</Link></li>
                  <li><Link to="/help" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Community</Link></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  Legal
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: 16 }}
                    className="h-0.5 bg-primary rounded-full"
                  ></motion.div>
                </h4>
                <ul className="space-y-3 text-sm text-gray-500">
                  <li><Link to="/legal/privacy" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Privacy Policy</Link></li>
                  <li><Link to="/legal/terms" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Terms of Service</Link></li>
                  <li><Link to="/legal/cookie" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Cookie Policy</Link></li>
                  <li><Link to="/legal/compliance" className="hover:text-primary transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gray-300"></span>Compliance</Link></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-gray-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-400 font-medium">© 2024 V-Number Services Inc. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-green-600 dark:text-green-400 font-bold">System Operational</span>
              </div>
              <select className="bg-transparent text-xs font-bold text-gray-500 border-none focus:ring-0 cursor-pointer">
                <option>English (US)</option>
                <option>Español</option>
                <option>Français</option>
              </select>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default LandingPage;