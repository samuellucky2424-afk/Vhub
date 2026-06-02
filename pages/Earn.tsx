import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../App';
import { supabase } from '../src/lib/supabase';
import { formatNaira } from '../src/utils/formatCurrency';

type EarnWallState = {
  loading: boolean;
  url: string;
  error: string | null;
};

const Earn: React.FC = () => {
  const { user, wallet, fetchWallet } = useApp();
  const [wallState, setWallState] = useState<EarnWallState>({
    loading: true,
    url: '',
    error: null,
  });

  const loadSurveyWall = useCallback(async () => {
    setWallState((current) => ({ ...current, loading: true, error: null }));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Please log in again to load surveys.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cpx-wall`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      const rawResponse = await response.text();
      const parsedResponse = rawResponse ? JSON.parse(rawResponse) : {};

      if (!response.ok || !parsedResponse.url) {
        throw new Error(parsedResponse.error || 'Survey wall is not available right now.');
      }

      setWallState({
        loading: false,
        url: parsedResponse.url,
        error: null,
      });
    } catch (error) {
      console.error('[Earn] Survey wall load error:', error);
      setWallState({
        loading: false,
        url: '',
        error: error instanceof Error ? error.message : 'Survey wall is not available right now.',
      });
    }
  }, []);

  useEffect(() => {
    loadSurveyWall();
  }, [loadSurveyWall]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-10 shrink-0 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-background-dark px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[#181511] dark:text-white text-xl font-bold leading-tight">Earn Credits</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Complete surveys and earn credits you can use to buy numbers. Once approved, your reward is added to your balance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="h-11 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 flex items-center justify-between gap-4 min-w-[210px]">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Balance</span>
              <span className="text-sm font-black text-primary">{formatNaira(wallet?.balance_kobo ?? 0)}</span>
            </div>
            <button
              onClick={fetchWallet}
              className="h-11 px-4 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-bold hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              Refresh Balance
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-5">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5">
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Earn Wallet Credit</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Rewards are added after your completed survey is approved.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5">
            <div className="size-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined">verified</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Approved Credit Flow</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Survey completions are checked securely before your balance is updated.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5">
            <div className="size-10 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined">person_search</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Find Surveys</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Surveys open with your account so approved rewards can be credited to the right balance.
            </p>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Survey Wall</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Signed in as {user?.email || user?.name || 'your account'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadSurveyWall}
                className="h-10 px-4 rounded-lg border border-slate-200 dark:border-zinc-700 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
                Reload
              </button>
              {wallState.url && (
                <a
                  href={wallState.url}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-4 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                  Open
                </a>
              )}
            </div>
          </div>

          {wallState.loading ? (
            <div className="min-h-[520px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-4xl text-primary animate-pulse">travel_explore</span>
                <span className="text-sm font-semibold">Loading surveys...</span>
              </div>
            </div>
          ) : wallState.error ? (
            <div className="min-h-[520px] flex items-center justify-center p-6 text-center">
              <div className="max-w-md">
                <div className="size-12 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined">warning</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">Survey wall unavailable</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{wallState.error}</p>
                <button
                  onClick={loadSurveyWall}
                  className="mt-5 h-10 px-5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <iframe
              title="Survey Wall"
              src={wallState.url}
              className="block w-full min-h-[780px] border-0 bg-white"
              allow="clipboard-write; fullscreen; payment"
            />
          )}
        </section>
      </main>
    </div>
  );
};

export default Earn;
