import React from 'react';
import { Button } from '@/components/ui/button';
import { Activity, Zap, ZapOff } from 'lucide-react';

const SHOCKABLE_RHYTHMS = [
  { id: 'VF', label: 'VF', full: 'Ventricular Fibrillation' },
  { id: 'pVT', label: 'pVT', full: 'Pulseless VT' }
];

const NON_SHOCKABLE_RHYTHMS = [
  { id: 'Asystole', label: 'Asystole', full: 'Asystole' },
  { id: 'PEA', label: 'PEA', full: 'Pulseless Electrical Activity' },
  { id: 'Sinus', label: 'Sinus', full: 'Sinus Rhythm (ROSC?)' }
];

export default function RhythmSelector({ currentRhythm, onRhythmChange }) {
  const isShockable = SHOCKABLE_RHYTHMS.some(r => r.id === currentRhythm);

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="w-5 h-5 text-slate-400" />
        <span className="text-slate-400 text-sm font-medium tracking-wide uppercase">Heart Rhythm</span>
      </div>

      <div className="space-y-4">
        {/* Shockable Rhythms */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">Shockable</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SHOCKABLE_RHYTHMS.map((rhythm) => (
              <Button
                key={rhythm.id}
                variant={currentRhythm === rhythm.id ? "default" : "outline"}
                className={`h-14 text-lg font-bold transition-all ${
                  currentRhythm === rhythm.id 
                    ? 'bg-red-600 hover:bg-red-700 border-red-500 text-white shadow-lg shadow-red-500/30' 
                    : 'border-red-800 text-red-400 hover:bg-red-900/50 hover:border-red-600'
                }`}
                onClick={() => onRhythmChange(rhythm.id)}
              >
                {rhythm.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Non-Shockable Rhythms */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ZapOff className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Non-Shockable</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {NON_SHOCKABLE_RHYTHMS.map((rhythm) => (
              <Button
                key={rhythm.id}
                variant={currentRhythm === rhythm.id ? "default" : "outline"}
                className={`h-14 text-sm font-bold transition-all ${
                  currentRhythm === rhythm.id 
                    ? 'bg-blue-600 hover:bg-blue-700 border-blue-500 text-white shadow-lg shadow-blue-500/30' 
                    : 'border-blue-800 text-blue-400 hover:bg-blue-900/50 hover:border-blue-600'
                }`}
                onClick={() => onRhythmChange(rhythm.id)}
              >
                {rhythm.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Current Status */}
        <div className={`rounded-xl p-4 text-center font-bold text-lg ${
          isShockable 
            ? 'bg-red-900/30 border border-red-600 text-red-300' 
            : 'bg-blue-900/30 border border-blue-600 text-blue-300'
        }`}>
          {currentRhythm ? (
            <>
              {isShockable ? '⚡ SHOCKABLE RHYTHM' : '💙 NON-SHOCKABLE RHYTHM'}
            </>
          ) : (
            <span className="text-slate-400">Select rhythm after pulse check</span>
          )}
        </div>
      </div>
    </div>
  );
}