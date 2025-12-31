import React from 'react';
import { Clock } from 'lucide-react';

export default function CPRTimer({ seconds }) {
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
      <div className="flex items-center gap-3 mb-2">
        <Clock className="w-5 h-5 text-slate-400" />
        <span className="text-slate-400 text-sm font-medium tracking-wide uppercase">Total CPR Time</span>
      </div>
      <div className="text-6xl md:text-7xl font-mono font-bold text-white tracking-tight">
        {formatTime(seconds)}
      </div>
    </div>
  );
}