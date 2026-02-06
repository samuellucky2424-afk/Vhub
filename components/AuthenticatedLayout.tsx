import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../App';

const AuthenticatedLayout: React.FC = () => {
  const { logout, user } = useApp();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Don't show sidebar for checkout flow or success page, but keep the layout structure
  const isCheckout = location.pathname.includes('/checkout');

  const navItems = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { path: '/checkout/summary', icon: 'add_shopping_cart', label: 'Buy Numbers' }, // Direct link to buy for convenience
    { path: '/numbers', icon: 'tag', label: 'My Numbers', fill: 1 },
    { path: '/store', icon: 'storefront', label: 'Store' },
    { path: '/profile', icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-[#2d2516] border-b border-[#e6e2db] dark:border-[#3d3322] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="bg-primary size-8 rounded-lg flex items-center justify-center text-white">
                <span className="material-symbols-outlined">cell_tower</span>
            </div>
            <span className="font-bold text-lg">V-Number</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {/* Sidebar - Hidden on mobile unless toggled */}
      {!isCheckout && (
        <aside className={`
            fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-[#2d2516] border-r border-[#e6e2db] dark:border-[#3d3322] flex flex-col transition-transform duration-300 transform lg:transform-none
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-6 hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="bg-primary size-10 rounded-lg flex items-center justify-center text-white">
                <span className="material-symbols-outlined">cell_tower</span>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight tracking-tight">V-Number</h1>
                <p className="text-xs text-slate-500 dark:text-[#b0a085]">User Dashboard</p>
              </div>
            </div>
          </div>
          
          <div className="lg:hidden p-6 mt-12">
             <div className="flex items-center gap-3 mb-6">
                 <img src={user?.avatar} alt="User" className="size-10 rounded-full" />
                 <div>
                     <p className="font-bold">{user?.name}</p>
                     <p className="text-xs opacity-70">{user?.email}</p>
                 </div>
             </div>
          </div>

          <nav className="flex-1 px-4 space-y-1 mt-4 lg:mt-0">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-primary/10 text-primary font-bold' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-medium'}
                `}
              >
                <span className="material-symbols-outlined text-[24px]" style={item.fill ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-[#e6e2db] dark:border-[#3d3322] space-y-2">
            <NavLink to="/checkout/summary" className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm">
              <span className="material-symbols-outlined text-sm">add</span>
              <span>New Number</span>
            </NavLink>
            <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-zinc-400 text-sm hover:text-red-500 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span>Logout</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden ${isCheckout ? 'w-full' : ''}`}>
        <Outlet />
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && !isCheckout && (
        <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default AuthenticatedLayout;