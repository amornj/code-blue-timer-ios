import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function CycleTracker({ cycle, cycleSeconds }) {
  const progress = (cycleSeconds / 120) * 100;
  const remainingSeconds = 120 - cycleSeconds;
  
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const isUrgent = remainingSeconds <= 10;

  return (
    <div className={`rounded-2xl p-6 border shadow-2xl transition-all duration-300 ${
      isUrgent 
        ? 'bg-gradient-to-br from-amber-900/50 to-amber-950 border-amber-500 animate-pulse' 
        : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <RefreshCw className={`w-5 h-5 ${isUrgent ? 'text-amber-400' : 'text-slate-400'}`} />
          <span className={`text-sm font-medium tracking-wide uppercase ${isUrgent ? 'text-amber-400' : 'text-slate-400'}`}>
            Cycle
          </span>
        </div>
        <div className="text-4xl font-bold text-white">{cycle}</div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className={isUrgent ? 'text-amber-300' : 'text-slate-400'}>Time remaining</span>
          <span className={`font-mono font-bold ${isUrgent ? 'text-amber-300 text-lg' : 'text-white'}`}>
            {formatTime(remainingSeconds)}
          </span>
        </div>
        
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${
              isUrgent ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {isUrgent && (
          <div className="text-center text-amber-400 font-semibold animate-pulse">
            ⚠️ PREPARE FOR CYCLE CHANGE
          </div>
        )}
      </div>
    </div>
  );
}