import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const LegalPage: React.FC = () => {
  const navigate = useNavigate();
  const { section } = useParams();

  const titles: Record<string, string> = {
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    cookie: "Cookie Policy",
    compliance: "Compliance & Safety"
  };

  const title = titles[section || 'privacy'] || "Legal Information";

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-6">
        <button onClick={() => navigate('/')} className="mb-6 text-sm font-bold text-gray-500 hover:text-primary">← Back to Home</button>
        
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 md:p-12 border border-gray-200 dark:border-zinc-800 shadow-sm">
            <h1 className="text-3xl md:text-4xl font-black mb-8 pb-8 border-b border-gray-100 dark:border-zinc-800">{title}</h1>
            
            <div className="prose prose-slate dark:prose-invert max-w-none">
                <p>Last Updated: October 24, 2024</p>
                <h3>1. Introduction</h3>
                <p>Welcome to V-Number. By using our services, you agree to these terms. This is a generic placeholder text for the {title} page. In a real application, this would contain the full legal text relevant to the selected section.</p>
                
                <h3>2. Data Collection</h3>
                <p>We collect minimal data necessary to provide our services. We do not sell your personal data to third parties. For OTP verification, we temporarily store the message content to display it to you, then delete it permanently.</p>
                
                <h3>3. Usage Policy</h3>
                <p>Our numbers are for verification purposes only. Any illegal activity or spamming is strictly prohibited and will result in immediate account termination.</p>
                
                <h3>4. Contact Us</h3>
                <p>If you have any questions about this {title}, please contact our legal team at legal@v-number.com.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;