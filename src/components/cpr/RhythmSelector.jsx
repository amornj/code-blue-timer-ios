import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Activity, Zap, ZapOff, AlertTriangle } from 'lucide-react';

const SHOCKABLE_RHYTHMS = [
  { id: 'VF', label: 'VF', full: 'Ventricular Fibrillation' },
  { id: 'pVT', label: 'Pulseless VT', full: 'Pulseless VT' }
];

const NON_SHOCKABLE_RHYTHMS = [
  { id: 'Asystole', label: 'Asystole', full: 'Asystole' },
  { id: 'PEA', label: 'PEA', full: 'Pulseless Electrical Activity' },
  { id: 'Sinus', label: 'Sinus', full: 'Sinus Rhythm (ROSC?)' }
];

const ENERGY_OPTIONS = [120, 150, 200, 250, 300, 360];

export default function RhythmSelector({ currentRhythm, rhythmSelectionStage, onRhythmChange, onShockDelivered, shockCount, shockDeliveredThisCycle }) {
  const isShockable = SHOCKABLE_RHYTHMS.some(r => r.id === currentRhythm);
  const [showShockDialog, setShowShockDialog] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState(200);

  const handleShock = () => {
    onShockDelivered(selectedEnergy);
    setShowShockDialog(false);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-slate-400" />
          <span className="text-slate-400 text-sm font-medium tracking-wide uppercase">Heart Rhythm</span>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${
          rhythmSelectionStage === 'unselected' 
            ? 'bg-amber-900/50 text-amber-300 border border-amber-500' 
            : 'bg-green-900/50 text-green-300 border border-green-500'
        }`}>
          {rhythmSelectionStage === 'unselected' ? 'Select Rhythm' : 'Rhythm Selected'}
        </div>
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
                onClick={() => rhythmSelectionStage === 'unselected' && onRhythmChange(rhythm.id)}
                disabled={rhythmSelectionStage === 'selected' && currentRhythm !== rhythm.id}
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
                onClick={() => rhythmSelectionStage === 'unselected' && onRhythmChange(rhythm.id)}
                disabled={rhythmSelectionStage === 'selected' && currentRhythm !== rhythm.id}
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

        {/* Shock Button - Only shown when shockable rhythm selected */}
        {isShockable && (
          <Button
            onClick={() => setShowShockDialog(true)}
            disabled={shockDeliveredThisCycle}
            className={`w-full h-16 text-lg font-bold rounded-xl ${
              shockDeliveredThisCycle
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg animate-pulse'
            }`}
          >
            <Zap className="w-6 h-6 mr-2" />
            {shockDeliveredThisCycle 
              ? 'SHOCK DELIVERED' 
              : `DELIVER SHOCK (${shockCount} delivered)`}
          </Button>
        )}

        {/* Non-Shockable Rhythm Alert */}
        {currentRhythm && (currentRhythm === 'PEA' || currentRhythm === 'Asystole') && (
          <div className="bg-blue-900/50 border-2 border-blue-500 rounded-xl p-4 text-center">
            <div className="text-blue-300 font-bold text-lg">
              ⚠️ Start CPR immediately
            </div>
          </div>
        )}
      </div>

      {/* Shock Dialog */}
      <Dialog open={showShockDialog} onOpenChange={setShowShockDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-yellow-400">
              <AlertTriangle className="w-6 h-6" />
              Confirm Defibrillation
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-slate-300 text-sm">Select energy level (Joules):</div>
            
            <div className="grid grid-cols-3 gap-2">
              {ENERGY_OPTIONS.map((energy) => (
                <Button
                  key={energy}
                  variant={selectedEnergy === energy ? "default" : "outline"}
                  className={`h-14 text-lg font-bold ${
                    selectedEnergy === energy 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                      : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                  }`}
                  onClick={() => setSelectedEnergy(energy)}
                >
                  {energy}J
                </Button>
              ))}
            </div>

            <Button
              onClick={handleShock}
              className="w-full h-16 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white text-xl font-bold mt-4"
            >
              <Zap className="w-6 h-6 mr-2" />
              SHOCK DELIVERED @ {selectedEnergy}J
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}