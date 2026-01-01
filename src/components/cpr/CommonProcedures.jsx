import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PROCEDURES = [
  { 
    short: 'A line', 
    full: 'A line insertion',
    color: 'bg-sky-600 hover:bg-sky-700'
  },
  { 
    short: 'Central line', 
    full: 'Central line insertion',
    color: 'bg-indigo-600 hover:bg-indigo-700'
  },
  { 
    short: 'ETT', 
    full: 'Endotracheal intubation',
    color: 'bg-blue-600 hover:bg-blue-700'
  },
  { 
    short: 'Echo', 
    full: 'Bedside echocardiography',
    color: 'bg-purple-600 hover:bg-purple-700'
  },
  { 
    short: 'ECMO', 
    full: 'ECMO insertion',
    color: 'bg-fuchsia-600 hover:bg-fuchsia-700'
  },
  { 
    short: '6H6T', 
    full: 'Common causes of cardiac arrest',
    color: 'bg-rose-600 hover:bg-rose-700',
    special: true
  }
];

const CAUSES_6H6T = [
  'Hypovolemia',
  'Hypoxia',
  'Hydrogen ion excess (acidosis)',
  'Hypoglycemia*',
  'Hypokalemia',
  'Hyperkalemia',
  'Hypothermia',
  'Tension pneumothorax',
  'Tamponade - Cardiac',
  'Toxins',
  'Thrombosis (pulmonary embolus)',
  'Thrombosis (myocardial infarction)'
];

export default function CommonProcedures({ onAddProcedure, usedProcedures = [], disabled = false }) {
  const [show6H6T, setShow6H6T] = useState(false);

  const handleProcedureClick = (proc) => {
    if (proc.special) {
      setShow6H6T(true);
    } else {
      const isUsed = usedProcedures.includes(proc.short);
      if (!isUsed) {
        onAddProcedure({
          procedure: proc.full
        });
      }
    }
  };

  return (
    <>
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-slate-400 text-sm font-medium tracking-wide uppercase">Procedures</span>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {PROCEDURES.map((proc) => {
            const isUsed = usedProcedures.includes(proc.short);
            const canBeUsedMultipleTimes = proc.short === 'Echo' || proc.special;
            const isDisabled = disabled || (isUsed && !canBeUsedMultipleTimes);
            
            return (
              <Button
                key={proc.short}
                onClick={() => handleProcedureClick(proc)}
                disabled={isDisabled}
                className={`h-14 text-base font-bold ${
                  isDisabled 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : proc.color
                } text-white`}
              >
                {proc.short}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 6H6T Dialog */}
      <Dialog open={show6H6T} onOpenChange={setShow6H6T}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">6H6T - Common Causes of Cardiac Arrest</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2 py-4">
            {CAUSES_6H6T.map((cause, index) => (
              <div key={index} className="flex items-start gap-3 p-2 bg-slate-800 rounded-lg">
                <span className="text-slate-400 font-mono text-sm">•</span>
                <span className="text-slate-200 text-sm">{cause}</span>
              </div>
            ))}
          </div>
          
          <Button
            onClick={() => setShow6H6T(false)}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}