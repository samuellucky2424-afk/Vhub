import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../App';

const AuthenticatedLayout: React.FC = () => {
  const { logout, user } = useApp();
  const location = useLocation();

  const isCheckout = location.pathname.includes('/checkout');

  const sidebarNavItems = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { path: '/checkout/summary', icon: 'add_shopping_cart', label: 'Buy Numbers' },
    { path: '/numbers', icon: 'tag', label: 'My Numbers', fill: 1 },
    { path: '/store', icon: 'storefront', label: 'Store' },
    { path: '/support', icon: 'support_agent', label: 'Support' },
  ];

  const bottomNavItems = [
    { path: '/dashboard', icon: 'home', label: 'Home' },
    { path: '/checkout/summary', icon: 'add_shopping_cart', label: 'Buy Number' },
    { path: '/numbers', icon: 'tag', label: 'My Numbers', fill: 1 },
    { path: '/support', icon: 'support_agent', label: 'Support' },
    { path: '/profile', icon: 'person', label: 'Profile' },
  ];

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white">

      {/* Desktop Sidebar - hidden on mobile */}
      {!isCheckout && (
        <aside className="hidden lg:flex fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white dark:bg-[#2d2516] border-r border-[#e6e2db] dark:border-[#3d3322] flex-col">
          <div className="p-6">
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

          <nav className="flex-1 px-4 space-y-1">
            {sidebarNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
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

      {/* Main Content — extra bottom padding on mobile for bottom nav */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden lg:pt-0 pb-16 lg:pb-0 ${isCheckout ? 'w-full' : ''}`}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar — always visible */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#2d2516] border-t border-[#e6e2db] dark:border-[#3d3322] flex items-center justify-around px-1 py-1 safe-area-bottom">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
                flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[56px] transition-colors
                ${isActive
                ? 'text-primary'
                : 'text-slate-400 dark:text-zinc-500'}
              `}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={item.fill ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {item.icon}
            </span>
            <span className="text-[10px] font-semibold leading-none">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default AuthenticatedLayout;