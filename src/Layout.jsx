import React from 'react';

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-slate-950 safe-area-top">
      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}
