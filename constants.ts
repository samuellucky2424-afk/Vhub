import { VirtualNumber } from './types';

export const INITIAL_NUMBERS: VirtualNumber[] = [
  {
    id: '1',
    number: '+1 202-555-0123',
    country: 'US',
    service: 'WhatsApp',
    status: 'Active',
    expiresAt: '2023-12-31',
    logs: [
      {
        id: 'log1',
        sender: 'WhatsApp',
        message: 'Your WhatsApp code is 892-104. Do not share this code with anyone.',
        code: '892104',
        receivedAt: '2 mins ago',
        isRead: false,
      },
      {
        id: 'log2',
        sender: 'WhatsApp',
        message: 'Welcome to WhatsApp! Tap the link to set up your profile: https://wa.me/setup',
        receivedAt: '15 mins ago',
        isRead: true,
      }
    ]
  },
  {
    id: '2',
    number: '+44 7700 900077',
    country: 'UK',
    service: 'Telegram',
    status: 'Active',
    expiresAt: '2023-11-15',
    logs: []
  },
  {
    id: '3',
    number: '+33 6 12 34 56 78',
    country: 'FR',
    service: 'Google',
    status: 'Active',
    expiresAt: '2023-11-20',
    logs: [
        {
            id: 'log3',
            sender: 'Google',
            message: 'G-123456 is your Google verification code.',
            code: '123456',
            receivedAt: '1 hour ago',
            isRead: true
        }
    ]
  }
];

export const MOCK_USER = {
  name: 'Alex Johnson',
  email: 'alex.johnson@example.com',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAGez2lRi-N6yqQ8k7BgM0fjOqj0yVJrKq3S8gXinAbfrokZOPSGfAsnTIGFCh_YELLHm8BDrnwRr0vUgSOLTe5ch0m5D_MsQypmT5vltziOAuKEBs4mtoVNFbXdO1Is-DcaE9VfBRXMdvWQDvOdP0PXqYUzU9HLRrKIdJwAB62OOHcU2InGtVQ2PIl4T6mZyEKzfhbcccdIWzWtuWjuRy09kEHGrJg7_WZvRuNKAKYeJC1NIZro2VyLfJg9XCB6n6Asj_hHBNSOtUR',
  plan: 'Pro' as const,
  memberSince: 'Jan 2023'
};
