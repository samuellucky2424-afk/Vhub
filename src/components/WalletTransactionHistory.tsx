import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/formatCurrency';

type WalletTransaction = {
  id: string;
  user_id: string;
  amount_kobo: number | string | null;
  currency?: string | null;
  type: string;
  reference?: string | null;
  status?: string | null;
  created_at: string;
};

function getTransactionLabel(transaction: WalletTransaction) {
  const reference = transaction.reference || '';
  const type = transaction.type || '';

  if (reference.startsWith('cpx_reversal_')) return 'Survey reversal';
  if (reference.startsWith('cpx_')) return 'Survey reward';
  if (reference.startsWith('fund_')) return 'Wallet deposit';
  if (type === 'refund') return 'Refund';
  if (type === 'debit' || type === 'purchase') return 'Purchase';
  if (type === 'deposit') return 'Wallet credit';
  if (type === 'adjustment') return 'Wallet adjustment';

  return 'Wallet transaction';
}

function getTransactionIcon(transaction: WalletTransaction) {
  const reference = transaction.reference || '';
  const type = transaction.type || '';

  if (reference.startsWith('cpx_')) return 'assignment_turned_in';
  if (reference.startsWith('fund_')) return 'account_balance_wallet';
  if (type === 'refund') return 'keyboard_return';
  if (type === 'debit' || type === 'purchase') return 'shopping_cart';

  return 'receipt_long';
}

function getReferenceLabel(reference?: string | null) {
  if (!reference) return 'No reference';
  if (reference.length <= 18) return reference;
  return `${reference.slice(0, 10)}...${reference.slice(-6)}`;
}

const WalletTransactionHistory: React.FC = () => {
  const { user, wallet } = useApp();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user?.id) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('wallet_transactions')
      .select('id, user_id, amount_kobo, currency, type, reference, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12);

    if (fetchError) {
      console.error('[WalletTransactionHistory] Fetch error:', fetchError);
      setError('Could not load wallet history right now.');
      setTransactions([]);
    } else {
      setTransactions((data || []) as WalletTransaction[]);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, wallet?.balance_kobo]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const channel = supabase
      .channel(`wallet-transactions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchTransactions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTransactions, user?.id]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="px-4 py-8 flex items-center justify-center text-slate-400 text-sm">
          <span className="material-symbols-outlined text-[20px] mr-2 animate-spin">refresh</span>
          Loading history...
        </div>
      );
    }

    if (error) {
      return (
        <div className="px-4 py-8 text-center">
          <span className="material-symbols-outlined text-2xl text-amber-500 mb-2 block">warning</span>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <button onClick={fetchTransactions} className="mt-3 text-xs font-bold text-primary hover:underline">
            Try again
          </button>
        </div>
      );
    }

    if (transactions.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-slate-400 text-sm">
          <span className="material-symbols-outlined text-2xl mb-1 block opacity-40">receipt_long</span>
          No wallet history yet
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
        {transactions.map((transaction) => {
          const amountKobo = Number(transaction.amount_kobo || 0);
          const isCredit = amountKobo >= 0;

          return (
            <div key={transaction.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-zinc-800/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${isCredit
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                  }`}>
                  <span className="material-symbols-outlined text-[20px]">{getTransactionIcon(transaction)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{getTransactionLabel(transaction)}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {new Date(transaction.created_at).toLocaleString()} - {getReferenceLabel(transaction.reference)}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className={`text-sm font-black ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {isCredit ? '+' : '-'}{formatNaira(Math.abs(amountKobo))}
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-400">{transaction.status || 'completed'}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [error, fetchTransactions, loading, transactions]);

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/20">
        <div>
          <h3 className="text-sm font-bold">Transaction History</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Survey credits, deposits, purchases, and refunds</p>
        </div>
        <button onClick={fetchTransactions} className="size-9 rounded-lg hover:bg-white dark:hover:bg-zinc-800 flex items-center justify-center text-primary transition-colors">
          <span className="material-symbols-outlined text-[20px]">refresh</span>
        </button>
      </div>
      {content}
    </section>
  );
};

export default WalletTransactionHistory;
