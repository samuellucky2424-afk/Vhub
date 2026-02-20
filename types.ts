export interface User {
  id?: string;
  name: string;
  email: string;
  avatar: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  memberSince: string;
}

export interface VirtualNumber {
  id: string;
  number: string;
  country: string; // 'US', 'UK', etc.
  service: string; // 'WhatsApp', 'Telegram', etc.
  status: 'Active' | 'Expired' | 'Completed' | 'Pending' | 'Failed' | 'Refunded';
  expiresAt: string;
  logs: SMSLog[];
}

export interface SMSLog {
  id: string;
  sender: string; // 'WhatsApp', 'Google', etc.
  message: string;
  code?: string;
  receivedAt: string;
  isRead: boolean;
}

export interface AppState {
  user: User | null;
  balance: number;

  activeNumbers: VirtualNumber[];
  transactions: any[];
  isAuthenticated: boolean;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance_kobo: number;
  locked_balance: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount_kobo: number;
  type: 'deposit' | 'purchase' | 'refund' | 'adjustment' | 'debit' | 'referral_reward';
  reference?: string;
  status?: string;
  currency?: string;
  created_at: string;
}

export interface Referral {
  id: string;
  user_id: string;
  referral_code: string;
  created_at: string;
}

export interface ReferralUsage {
  id: string;
  referral_code: string;
  referred_user_id: string;
  referred_name?: string;
  referred_email?: string;
  reward_credited: boolean;
  created_at: string;
}

export interface AppContextType extends AppState {
  loading: boolean;
  login: (userData?: Partial<User>) => void;
  logout: () => void;
  addNumber: (newNumber: VirtualNumber) => void;
  deductBalance: (amount: number) => void;
  refreshNumbers: () => Promise<void>;
  wallet: Wallet | null;
  fetchWallet: () => Promise<void>;
}