import React from 'react';
import { RefreshCw, Zap, Syringe, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function CycleTracker({ cycle, cycleSeconds, totalSeconds, shockCount, adrenalineCount, amiodaroneTotal, lidocaineCumulativeDose = 0, soundEnabled, onSoundToggle, hasStarted }) {
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
      {/* Total CPR Time */}
      <div className="mb-6 text-center relative">
        {/* Sound Toggle - Top Right */}
        <div className="absolute top-0 right-0 flex flex-col items-center gap-1.5">
          <span className={`text-xs font-semibold uppercase tracking-wider ${soundEnabled ? 'text-green-400' : 'text-slate-400'}`}>
            SOUND
          </span>
          <Switch
            checked={soundEnabled}
            onCheckedChange={onSoundToggle}
            disabled={!hasStarted}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-medium tracking-wide uppercase text-slate-400">
            Total CPR Time
          </span>
        </div>
        <div className="text-5xl font-bold text-white font-mono">
          {formatTime(totalSeconds)}
        </div>
      </div>

      {/* Cycle Info */}
      <div className="flex items-center justify-between mb-4 pt-4 border-t border-slate-700">
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

        {/* Counter Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <Zap className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
          <div className="text-xl font-bold text-white">{shockCount}</div>
          <div className="text-xs text-slate-400">Shocks</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <Syringe className="w-4 h-4 mx-auto mb-1 text-red-400" />
          <div className="text-xl font-bold text-white">{adrenalineCount}</div>
          <div className="text-xs text-slate-400">Adrenaline</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <IVBagIcon className="w-4 h-4 mx-auto mb-1 text-purple-400" />
          <div className="text-xl font-bold text-white">{amiodaroneTotal}</div>
          <div className="text-xs text-slate-400">Amiodarone</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 text-center">
          <Syringe className="w-4 h-4 mx-auto mb-1 text-teal-400" />
          <div className="text-xl font-bold text-white">{lidocaineCumulativeDose}</div>
          <div className="text-xs text-slate-400">Lidocaine</div>
        </div>
        </div>
        </div>
        );
        }

        function IVBagIcon({ className }) {
        return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v1.5M15 3v1.5M9 4.5h6M8 8h8v12a2 2 0 01-2 2h-4a2 2 0 01-2-2V8zM10 12h4M10 15h4" />
        </svg>
        );
        }