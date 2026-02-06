import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { motion } from 'framer-motion';

const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useApp();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
    }

    if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
    }

    setIsLoading(true);
    // Simulate network delay
    setTimeout(() => {
        login({ name, email });
        navigate('/dashboard');
    }, 1500);
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
        {/* Animated Background Blobs */}
        <motion.div 
            animate={{ scale: [1, 1.3, 1], x: [0, 50, 0], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-10 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
        ></motion.div>
        <motion.div 
            animate={{ scale: [1, 1.2, 1], y: [0, -50, 0], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
        ></motion.div>
        
        <div className="w-full max-w-[520px] z-10 my-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="bg-white dark:bg-[#2d2518] shadow-2xl shadow-black/10 rounded-2xl border border-[#e6e2db] dark:border-white/5 overflow-hidden"
          >
            <div className="p-8 md:p-10">
              <div className="text-center mb-8">
                <h1 className="text-[#181511] dark:text-white text-3xl font-black mb-2">Create Account</h1>
                <p className="text-[#897b61] dark:text-gray-400">Get your first virtual number in minutes</p>
              </div>
              
              <form className="space-y-5" onSubmit={handleSignUp}>
                <div className="space-y-2">
                  <label className="text-[#181511] dark:text-white text-sm font-bold">Full Name</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#897b61] text-xl group-focus-within:text-primary transition-colors">person</span>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-[#e6e2db] dark:border-white/10 bg-white dark:bg-background-dark text-[#181511] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium" 
                        placeholder="John Doe" 
                        required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[#181511] dark:text-white text-sm font-bold">Email Address</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#897b61] text-xl group-focus-within:text-primary transition-colors">mail</span>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-[#e6e2db] dark:border-white/10 bg-white dark:bg-background-dark text-[#181511] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium" 
                        placeholder="name@company.com" 
                        required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[#181511] dark:text-white text-sm font-bold">Password</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#897b61] text-xl group-focus-within:text-primary transition-colors">lock</span>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-[#e6e2db] dark:border-white/10 bg-white dark:bg-background-dark text-[#181511] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium" 
                                placeholder="••••••••" 
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[#181511] dark:text-white text-sm font-bold">Confirm</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#897b61] text-xl group-focus-within:text-primary transition-colors">lock_reset</span>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-[#e6e2db] dark:border-white/10 bg-white dark:bg-background-dark text-[#181511] dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium" 
                                placeholder="••••••••" 
                                required
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">error</span>
                        {error}
                    </motion.div>
                )}

                <div className="flex items-center gap-3 pt-2">
                    <input type="checkbox" id="terms" className="rounded text-primary focus:ring-primary border-[#e6e2db] cursor-pointer size-4" required />
                    <label htmlFor="terms" className="text-sm text-[#897b61] dark:text-gray-400 cursor-pointer select-none leading-tight">
                        I agree to the <a href="#" className="text-primary font-bold hover:underline">Terms of Service</a> and <a href="#" className="text-primary font-bold hover:underline">Privacy Policy</a>.
                    </label>
                </div>

                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-[#d48e0d] text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                    {isLoading ? (
                        <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                    ) : (
                        <>
                            <span>Create Account</span>
                            <span className="material-symbols-outlined text-lg">rocket_launch</span>
                        </>
                    )}
                </motion.button>
              </form>

              <div className="mt-8 flex items-center gap-4">
                <div className="h-[1px] flex-1 bg-[#e6e2db] dark:bg-white/10"></div>
                <span className="text-xs text-[#897b61] uppercase tracking-widest font-bold">Or sign up with</span>
                <div className="h-[1px] flex-1 bg-[#e6e2db] dark:bg-white/10"></div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <button onClick={handleSocialLogin} className="flex items-center justify-center gap-2 border border-[#e6e2db] dark:border-white/10 rounded-xl py-3 hover:bg-background-light dark:hover:bg-white/5 transition-all active:scale-95">
                  <span className="font-bold text-lg text-blue-500">G</span>
                  <span className="text-sm font-semibold text-[#181511] dark:text-white">Google</span>
                </button>
                <button onClick={handleSocialLogin} className="flex items-center justify-center gap-2 border border-[#e6e2db] dark:border-white/10 rounded-xl py-3 hover:bg-background-light dark:hover:bg-white/5 transition-all active:scale-95">
                  <span className="material-symbols-outlined text-[#181511] dark:text-white">favorite</span>
                  <span className="text-sm font-semibold text-[#181511] dark:text-white">Apple</span>
                </button>
              </div>
            </div>
            <div className="p-6 bg-background-light dark:bg-white/5 border-t border-[#e6e2db] dark:border-white/5 text-center">
                <p className="text-[#897b61] dark:text-gray-400 text-sm">
                    Already have an account? 
                    <span 
                        onClick={() => navigate('/login')}
                        className="text-primary font-bold hover:underline ml-1 cursor-pointer"
                    >
                        Sign in
                    </span>
                </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default SignUpPage;