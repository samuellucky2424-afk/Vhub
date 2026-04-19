import React from 'react';
import { TempEmailSection } from '../src/components/TempEmailSection';

const TempEmailPage: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto w-full">
            <TempEmailSection />
        </div>
    );
};

export default TempEmailPage;
