import React, { useState } from 'react';
import { useApp } from '../App';
import { VirtualNumber } from '../types';

const ActiveNumbers: React.FC = () => {
  const { activeNumbers } = useApp();
  // Initialize with null to force list view on mobile initially, or first item on desktop
  const [selectedNumberId, setSelectedNumberId] = useState<string | null>(activeNumbers[0]?.id || null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const selectedNumber = activeNumbers.find(n => n.id === selectedNumberId);

  const handleNumberClick = (id: string) => {
    setSelectedNumberId(id);
    setIsMobileDetailOpen(true);
  };

  const handleBackToList = () => {
    setIsMobileDetailOpen(false);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopyFeedback(code);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden relative">
      {/* Left Pane: Number List */}
      <div className={`
        w-full md:w-96 border-r border-[#e6e2db] dark:border-[#3d3322] bg-white dark:bg-[#2d2516] flex flex-col h-full overflow-hidden absolute inset-0 md:relative z-10
        ${isMobileDetailOpen ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="p-6 border-b border-[#e6e2db] dark:border-[#3d3322] shrink-0">
          <h2 className="text-xl font-black mb-1">Active Numbers</h2>
          <p className="text-sm text-[#897b61] dark:text-[#b0a085]">You have {activeNumbers.length} active services</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {activeNumbers.map((num) => (
            <div 
                key={num.id}
                onClick={() => handleNumberClick(num.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
                    selectedNumberId === num.id 
                    ? 'border-2 border-primary bg-primary/5 dark:bg-primary/10 shadow-sm' 
                    : 'border-[#e6e2db] dark:border-[#3d3322] hover:border-primary/50 bg-background-light/50 dark:bg-background-dark/50'
                }`}
            >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">
                                {num.service === 'WhatsApp' ? 'chat' : num.service === 'Telegram' ? 'send' : 'public'}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-primary uppercase tracking-tight">{num.service}</p>
                            <p className="text-lg font-bold truncate">{num.number}</p>
                        </div>
                    </div>
                    {num.status === 'Active' && <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-black rounded uppercase">Live</span>}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: '85%' }}></div>
                    </div>
                    <p className="text-xs font-medium text-[#181511] dark:text-white">Active</p>
                </div>
            </div>
          ))}
          {activeNumbers.length === 0 && (
              <div className="text-center p-8 text-slate-500">
                  <p>No numbers purchased yet.</p>
              </div>
          )}
        </div>
      </div>

      {/* Right Pane: SMS Logs */}
      <div className={`
        flex-1 bg-background-light dark:bg-background-dark flex flex-col h-full overflow-hidden absolute inset-0 md:relative z-20 md:z-auto bg-white md:bg-transparent
        ${isMobileDetailOpen ? 'flex' : 'hidden md:flex'}
      `}>
        {selectedNumber ? (
            <>
                <header className="h-auto min-h-[5rem] py-4 bg-white dark:bg-[#2d2516] border-b border-[#e6e2db] dark:border-[#3d3322] flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-8 shrink-0 gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleBackToList}
                            className="md:hidden size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-[28px]">sms</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold leading-tight">SMS Logs</h3>
                            <p className="text-sm text-[#897b61] dark:text-[#b0a085] truncate max-w-[150px] sm:max-w-xs">{selectedNumber.number}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleRefresh}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary font-bold hover:bg-primary/5 active:bg-primary/10 transition-colors"
                    >
                        <span className={`material-symbols-outlined text-sm ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh Logs'}</span>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                    <div className="max-w-3xl mx-auto flex flex-col gap-6">
                        {selectedNumber.logs.length > 0 ? (
                            selectedNumber.logs.map((log) => (
                                <div key={log.id} className="bg-white dark:bg-[#2d2516] rounded-xl border border-[#e6e2db] dark:border-[#3d3322] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="p-4 sm:p-6 border-b border-[#e6e2db] dark:border-[#3d3322] flex justify-between items-center bg-[#fcfbf9] dark:bg-[#322a1c]">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">verified_user</span>
                                            <span className="font-black text-sm uppercase tracking-wider">{log.sender} Verification</span>
                                        </div>
                                        <span className="text-xs text-[#897b61] dark:text-[#b0a085] font-medium whitespace-nowrap ml-2">{log.receivedAt}</span>
                                    </div>
                                    <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-6 items-center">
                                        <div className="flex-1 w-full">
                                            <p className="text-[#897b61] dark:text-[#b0a085] text-sm mb-2">Message Content:</p>
                                            <p className="text-base leading-relaxed italic">"{log.message}"</p>
                                        </div>
                                        {log.code && (
                                            <div className="w-full md:w-auto flex flex-col items-center gap-3 shrink-0 bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20">
                                                <p className="text-[10px] font-black text-primary uppercase">Verification Code</p>
                                                <p className="text-4xl font-black text-primary tracking-widest">{log.code}</p>
                                                <button 
                                                    onClick={() => handleCopy(log.code!)}
                                                    className="w-full bg-primary text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center gap-2 text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-sm">
                                                        {copyFeedback === log.code ? 'check' : 'content_copy'}
                                                    </span>
                                                    <span>{copyFeedback === log.code ? 'Copied!' : 'Copy Code'}</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                             <div className="py-12 flex flex-col items-center text-center opacity-40">
                                <div className="size-16 rounded-full border-4 border-dashed border-[#897b61] flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
                                </div>
                                <p className="text-[#897b61] dark:text-[#b0a085] font-medium">Waiting for incoming SMS...</p>
                                <p className="text-xs mt-1">Logs are automatically deleted after 24 hours</p>
                            </div>
                        )}
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="max-w-xs">
                    <div className="size-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl text-slate-400">touch_app</span>
                    </div>
                    <h3 className="text-lg font-bold mb-2">Select a number</h3>
                    <p className="text-slate-500 text-sm">Choose a number from the list to view its real-time SMS logs and verification codes.</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ActiveNumbers;
