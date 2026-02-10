import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { motion } from 'framer-motion';
import { supabase } from '../src/lib/supabase';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert(error.message);
      setIsLoading(false);
    } else {
      // Success - app listener will redirect/update state
      navigate('/dashboard');
    }
  };

  const handleSocialLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      login();
      navigate('/dashboard');
    }, 1000);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display">
      <header className="w-full px-6 lg:px-40 py-5 flex items-center justify-between bg-white dark:bg-background-dark border-b border-solid border-[#e6e2db] dark:border-white/10">
        <div className="flex items-center gap-2 text-[#181511] dark:text-white cursor-pointer group" onClick={() => navigate('/')}>
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
            <span className="material-symbols-outlined">cell_tower</span>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">V-Number</h2>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-sm font-semibold hover:text-primary transition-colors">Back to Home</button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
        ></motion.div>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 7, repeat: Infinity, delay: 1 }}
          className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
        ></motion.div>

        <div className="w-full max-w-[480px] z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="bg-white dark:bg-[#2d2518] shadow-xl shadow-black/5 rounded-xl border border-[#e6e2db] dark:border-white/5 overflow-hidden"
          >
            <div className="p-8 md:p-12">
              <div className="text-center mb-10">
                <h1 className="text-[#181511] dark:text-white text-3xl font-bold mb-2">Welcome Back</h1>
                <p className="text-[#897b61] dark:text-gray-400">Access your virtual number dashboard</p>
              </div>

              <form className="space-y-6" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="text-[#181511] dark:text-white text-sm font-semibold">Email Address</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#897b61] text-xl group-focus-within:text-primary transition-colors">mail</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 rounded-lg border border-[#e6e2db] dark:border-white/10 bg-white dark:bg-background-dark text-[#181511] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[#181511] dark:text-white text-sm font-semibold">Password</label>
                    <a className="text-primary text-xs font-semibold hover:underline cursor-pointer">Forgot password?</a>
                  </div>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#897b61] text-xl group-focus-within:text-primary transition-colors">lock</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3.5 rounded-lg border border-[#e6e2db] dark:border-white/10 bg-white dark:bg-background-dark text-[#181511] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#897b61] hover:text-[#181511] dark:hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-xl">visibility</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="remember" className="rounded text-primary focus:ring-primary border-[#e6e2db] cursor-pointer" />
                  <label htmlFor="remember" className="text-sm text-[#897b61] dark:text-gray-400 cursor-pointer select-none">Remember this device</label>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-[#d48e0d] text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </>
                  )}
                </motion.button>
              </form>

              <div className="mt-8 flex items-center gap-4">
                <div className="h-[1px] flex-1 bg-[#e6e2db] dark:bg-white/10"></div>
                <span className="text-xs text-[#897b61] uppercase tracking-widest font-bold">Or continue with</span>
                <div className="h-[1px] flex-1 bg-[#e6e2db] dark:bg-white/10"></div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <button onClick={handleSocialLogin} className="flex items-center justify-center gap-2 border border-[#e6e2db] dark:border-white/10 rounded-lg py-3 hover:bg-background-light dark:hover:bg-white/5 transition-all active:scale-95">
                  <span className="font-bold text-lg text-blue-500">G</span>
                  <span className="text-sm font-semibold text-[#181511] dark:text-white">Google</span>
                </button>
                <button onClick={handleSocialLogin} className="flex items-center justify-center gap-2 border border-[#e6e2db] dark:border-white/10 rounded-lg py-3 hover:bg-background-light dark:hover:bg-white/5 transition-all active:scale-95">
                  <span className="material-symbols-outlined text-[#181511] dark:text-white">favorite</span>
                  <span className="text-sm font-semibold text-[#181511] dark:text-white">Apple</span>
                </button>
              </div>
            </div>
            <div className="p-6 bg-background-light dark:bg-white/5 border-t border-[#e6e2db] dark:border-white/5 text-center">
              <p className="text-[#897b61] dark:text-gray-400 text-sm">
                Don't have an account?
                <span
                  onClick={() => navigate('/signup')}
                  className="text-primary font-bold hover:underline ml-1 cursor-pointer"
                >
                  Create an account
                </span>
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;