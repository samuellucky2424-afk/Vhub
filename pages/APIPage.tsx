import React from 'react';
import { useNavigate } from 'react-router-dom';

const APIPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-12 items-start">
            <div className="flex-1">
                 <button onClick={() => navigate('/')} className="mb-6 text-sm font-bold text-gray-500 hover:text-primary">← Back to Home</button>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">Integrate V-Number into your application</h1>
                <p className="text-xl text-gray-500 mb-8 leading-relaxed">
                    Automate your SMS verification workflows with our robust, developer-friendly API. 
                    Get instant access to thousands of numbers programmatically.
                </p>
                
                <div className="space-y-6 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mt-1">
                            <span className="material-symbols-outlined">bolt</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Instant Provisioning</h3>
                            <p className="text-gray-500">Request numbers and receive them in milliseconds.</p>
                        </div>
                    </div>
                     <div className="flex items-start gap-4">
                        <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mt-1">
                            <span className="material-symbols-outlined">webhook</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Webhooks</h3>
                            <p className="text-gray-500">Real-time notifications when an SMS is received.</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => navigate('/login')} className="px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20">Get API Key</button>
                    <button className="px-6 py-3 border border-gray-300 dark:border-zinc-700 font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800">Read Docs</button>
                </div>
            </div>

            <div className="w-full lg:w-1/2 bg-[#1e1e1e] rounded-xl shadow-2xl overflow-hidden border border-zinc-800">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-700 bg-[#252526]">
                    <div className="flex gap-1.5">
                        <div className="size-3 rounded-full bg-red-500"></div>
                        <div className="size-3 rounded-full bg-yellow-500"></div>
                        <div className="size-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="ml-2 text-xs text-zinc-400 font-mono">example_request.js</span>
                </div>
                <div className="p-6 overflow-x-auto">
<pre className="text-sm font-mono text-zinc-300 leading-relaxed">
<span className="text-purple-400">const</span> response = <span className="text-purple-400">await</span> fetch(<span className="text-green-400">'https://api.v-number.com/v1/orders'</span>, {'{'}
  method: <span className="text-green-400">'POST'</span>,
  headers: {'{'}
    <span className="text-green-400">'Authorization'</span>: <span className="text-green-400">'Bearer YOUR_API_KEY'</span>,
    <span className="text-green-400">'Content-Type'</span>: <span className="text-green-400">'application/json'</span>
  {'}'},
  body: JSON.stringify({'{'}
    country: <span className="text-green-400">'US'</span>,
    service: <span className="text-green-400">'whatsapp'</span>
  {'}'})
{'}'});

<span className="text-purple-400">const</span> data = <span className="text-purple-400">await</span> response.json();
console.log(data);
<span className="text-gray-500">// Output: {'{'} id: "123", number: "+15550123456", ... {'}'}</span>
</pre>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default APIPage;