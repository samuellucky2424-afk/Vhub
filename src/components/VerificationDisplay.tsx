import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface VerificationDisplayProps {
    orderId: string;
    initialExpiryTimestamp?: number; // Optional: Pass specific expiry time if available
}

export const VerificationDisplay = ({ orderId, initialExpiryTimestamp }: VerificationDisplayProps) => {
    const [smsCode, setSmsCode] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
    const [status, setStatus] = useState<'waiting' | 'received' | 'expired'>('waiting');

    useEffect(() => {
        // 10 Minute Countdown Logic
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (status === 'waiting') setStatus('expired');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [status]);

    useEffect(() => {
        if (!orderId) return;

        // Fetch initial state in case it arrived before component mounted
        const fetchOrder = async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('sms_code')
                .eq('id', orderId)
                .single();

            if (data?.sms_code) {
                setSmsCode(data.sms_code);
                setStatus('received');
            }
        };
        fetchOrder();

        // Subscribe to Realtime Updates
        const channel = supabase
            .channel(`order-updates-${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${orderId}`,
                },
                (payload) => {
                    console.log('Realtime update received:', payload);
                    const newCode = payload.new.sms_code;
                    if (newCode) {
                        setSmsCode(newCode);
                        setStatus('received');
                    }
                }
            )
            .subscribe();

        // Cleanup subscription on unmount
        return () => {
            supabase.removeChannel(channel);
        };
    }, [orderId]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const copyToClipboard = () => {
        if (smsCode) {
            navigator.clipboard.writeText(smsCode);
            // Optional: Add toast or visual feedback here
        }
    };

    return (
        <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md border border-gray-100 flex flex-col items-center space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">
                Verification Status
            </h3>

            {status === 'waiting' && (
                <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 text-sm">Waiting for SMS...</p>
                    <p className="text-xs text-gray-400">This usually takes 1-2 minutes</p>
                </div>
            )}

            {status === 'received' && smsCode && (
                <div className="w-full flex flex-col items-center space-y-3 animate-in fade-in zoom-in duration-300">
                    <div className="bg-green-50 px-6 py-3 rounded-lg border border-green-200 w-full text-center cursor-pointer hover:bg-green-100 transition-colors" onClick={copyToClipboard}>
                        <p className="text-xs text-green-600 uppercase font-bold tracking-wider mb-1">Your Code</p>
                        <p className="text-4xl font-mono font-bold text-green-700 tracking-widest">{smsCode}</p>
                        <p className="text-[10px] text-green-500 mt-1">Click to copy</p>
                    </div>
                    <p className="text-gray-600 font-medium">Success!</p>
                </div>
            )}

            {status === 'expired' && (
                <div className="flex flex-col items-center text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-semibold">Time Expired</p>
                    <p className="text-xs text-center text-gray-400 mt-1">We couldn't define the code in time. Please try again.</p>
                </div>
            )}

            {/* Countdown Timer */}
            <div className={`text-sm font-mono mt-4 ${timeLeft < 60 ? 'text-red-500' : 'text-gray-400'}`}>
                Expires in: {formatTime(timeLeft)}
            </div>
        </div>
    );
};
