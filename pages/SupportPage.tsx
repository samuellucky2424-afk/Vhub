import React from 'react';
import ContactSupport from '../components/ContactSupport';

const SupportPage: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
            <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">support_agent</span>
                Support Center
            </h1>
            <ContactSupport />
        </div>
    );
};

export default SupportPage;
