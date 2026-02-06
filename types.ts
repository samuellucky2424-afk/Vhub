export interface User {
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
  status: 'Active' | 'Expired' | 'Completed';
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

export interface AppContextType extends AppState {
  login: (userData?: Partial<User>) => void;
  logout: () => void;
  addNumber: (newNumber: VirtualNumber) => void;
  deductBalance: (amount: number) => void;
}