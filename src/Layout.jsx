import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Activity, FileText } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const navItems = [
    { name: 'CPRTracker', label: 'CPR Tracker', icon: Activity },
    { name: 'Records', label: 'Records', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Activity className="w-8 h-8 text-red-500" />
                <span className="text-xl font-bold text-white">CPR Tracker</span>
              </div>
              
              <div className="flex gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPageName === item.name;
                  return (
                    <Link
                      key={item.name}
                      to={createPageUrl(item.name)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}