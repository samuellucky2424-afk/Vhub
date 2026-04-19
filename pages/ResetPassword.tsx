import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../src/lib/supabase';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  // Check for recovery session on mount
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (type === 'recovery' && accessToken && refreshToken) {
      // Set up the recovery session from URL parameters
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ data, error }) => {
        if (error) {
          console.error('Failed to set recovery session:', error);
          setError('Invalid or expired reset link. Please request a new password reset.');
        } else {
          setHasRecoverySession(true);
        }
      });
    } else {
      setError('Invalid or expired reset link. Please request a new password reset.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!hasRecoverySession) {
      setError('Invalid or expired reset link. Please request a new password reset.');
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
          <button onClick={() => navigate('/login')} className="text-sm font-semibold hover:text-primary transition-colors">Back to Login</button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-[#e6e2db] dark:border-white/10 p-8">
            <div className="text-center mb-8">
              <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">lock_reset</span>
              </div>
              <h1 className="text-2xl font-bold text-[#181511] dark:text-white mb-2">Reset Password</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Enter your new password below</p>
            </div>

            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="size-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <h2 className="text-xl font-bold text-[#181511] dark:text-white mb-2">Password Reset Successful!</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Redirecting to login...</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
                  >
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                  </motion.div>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-semibold text-[#181511] dark:text-white mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-[#e6e2db] dark:border-white/20 bg-white dark:bg-zinc-800 text-[#181511] dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder="Enter new password"
                        required
                        minLength={6}
                      />
                      <span className="absolute right-3 top-3.5 material-symbols-outlined text-gray-400 text-sm">password</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[#181511] dark:text-white mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-[#e6e2db] dark:border-white/20 bg-white dark:bg-zinc-800 text-[#181511] dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder="Confirm new password"
                        required
                        minLength={6}
                      />
                      <span className="absolute right-3 top-3.5 material-symbols-outlined text-gray-400 text-sm">password</span>
                    </div>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">lock_reset</span>
                      Reset Password
                    </>
                  )}
                </motion.button>
              </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Remember your password?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-primary font-semibold hover:underline"
                >
                  Back to Login
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ResetPassword;
