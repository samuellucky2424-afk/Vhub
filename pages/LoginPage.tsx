import React, { useState, useEffect } from 'react';
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
  const [showEmailConfirmed, setShowEmailConfirmed] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if email was confirmed
    const emailConfirmed = localStorage.getItem('emailConfirmed');
    if (emailConfirmed === 'true') {
      setShowEmailConfirmed(true);
      localStorage.removeItem('emailConfirmed');
      // Clear the message after 5 seconds
      setTimeout(() => setShowEmailConfirmed(false), 5000);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      // Success - app listener will redirect/update state
      navigate('/dashboard');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: 'https://www.luckyv-num.store/#/reset-password'
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Password reset link sent! Check your email.');
      setForgotPasswordEmail('');
      // Hide forgot password form after 3 seconds
      setTimeout(() => {
        setShowForgotPassword(false);
        setMessage('');
      }, 3000);
    }
    setForgotPasswordLoading(false);
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

              {/* Email Confirmation Success Message */}
              {showEmailConfirmed && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                    <div>
                      <p className="text-green-800 dark:text-green-200 font-semibold">Email Confirmed Successfully!</p>
                      <p className="text-green-600 dark:text-green-400 text-sm">You can now log in to your account.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* General Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
                    <p className="text-red-800 dark:text-red-200">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Forgot Password Success Message */}
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">info</span>
                    <p className="text-blue-800 dark:text-blue-200">{message}</p>
                  </div>
                </motion.div>
              )}

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
                    <button 
                      type="button" 
                      onClick={() => setShowForgotPassword(true)}
                      className="text-primary text-xs font-semibold hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
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

              {/* Forgot Password Form */}
              {showForgotPassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 p-6 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-[#181511] dark:text-white">Reset Password</h3>
                    <button
                      onClick={() => {
                        setShowForgotPassword(false);
                        setError('');
                        setMessage('');
                      }}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#181511] dark:text-white mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-[#181511] dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    <motion.button
                      type="submit"
                      disabled={forgotPasswordLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {forgotPasswordLoading ? (
                        <>
                          <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">send</span>
                          Send Reset Link
                        </>
                      )}
                    </motion.button>
                  </form>
                </motion.div>
              )}


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