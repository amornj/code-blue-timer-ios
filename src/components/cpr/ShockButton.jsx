import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Zap, AlertTriangle } from 'lucide-react';

const ENERGY_OPTIONS = [120, 150, 200, 250, 300, 360];

export default function ShockButton({ isShockable, onShockDelivered, shockCount }) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState(200);

  const handleShock = () => {
    onShockDelivered(selectedEnergy);
    setShowDialog(false);
  };

  if (!isShockable) return null;

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        className="w-full h-24 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white text-2xl font-bold rounded-2xl shadow-2xl shadow-orange-500/30 border-2 border-yellow-400 animate-pulse"
      >
        <Zap className="w-10 h-10 mr-3" />
        DELIVER SHOCK
        <span className="ml-3 text-lg opacity-75">({shockCount} delivered)</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
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
    </>
  );
}