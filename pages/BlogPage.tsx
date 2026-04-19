import React from 'react';
import { useNavigate } from 'react-router-dom';

const BlogPage: React.FC = () => {
  const navigate = useNavigate();

  const posts = [
    {
        title: "The Future of SMS Verification",
        excerpt: "Why OTPs are changing and how businesses are adapting to new security standards.",
        date: "Oct 12, 2024",
        category: "Industry",
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800"
    },
    {
        title: "Protecting Your Digital Privacy",
        excerpt: "5 essential tips to keep your personal phone number private in the digital age.",
        date: "Sep 28, 2024",
        category: "Privacy",
        image: "https://images.unsplash.com/photo-1563206767-5b1d972b9fb1?auto=format&fit=crop&q=80&w=800"
    },
    {
        title: "V-Number API V2 Release",
        excerpt: "Introducing faster provisioning, webhooks, and improved country coverage.",
        date: "Sep 15, 2024",
        category: "Product Update",
        image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800"
    }
  ];

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <button onClick={() => navigate('/')} className="mb-6 text-sm font-bold text-gray-500 hover:text-primary">← Back to Home</button>
        <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-black mb-4">Latest Updates</h1>
            <p className="text-xl text-gray-500">News, insights, and updates from the V-Number team.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {posts.map((post, i) => (
                <article key={i} className="group cursor-pointer">
                    <div className="rounded-xl overflow-hidden mb-4 relative aspect-video">
                        <img src={post.image} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{post.category}</div>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{post.date}</div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{post.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2">{post.excerpt}</p>
                </article>
            ))}
        </div>
      </div>
    </div>
  );
};

export default BlogPage;