import React from 'react';
import { Button } from '@/components/ui/button';

const COMMON_MEDICATIONS = [
  { 
    short: 'Bicarb', 
    full: '7.5% Sodium Bicarbonate 50 mg IV',
    color: 'bg-teal-600 hover:bg-teal-700'
  },
  { 
    short: 'Ca', 
    full: '10% Calcium Gluconate 10 ml IV',
    color: 'bg-teal-600 hover:bg-teal-700'
  },
  { 
    short: 'Glu', 
    full: '50% Glucose 50 ml IV',
    color: 'bg-teal-600 hover:bg-teal-700'
  },
  { 
    short: 'Mg', 
    full: '50% Magnesium Sulfate 2 ml IV',
    color: 'bg-teal-600 hover:bg-teal-700'
  },
  { 
    short: 'KCl', 
    full: 'KCl 40 mEq in 5%DW 100 ml in 1 hour',
    color: 'bg-teal-600 hover:bg-teal-700'
  },
  { 
    short: 'Atropine', 
    full: 'Atropine 0.6 mg IV',
    color: 'bg-teal-600 hover:bg-teal-700'
  }
];

export default function CommonMedications({ onAddMedication }) {
  const handleMedClick = (med) => {
    onAddMedication({
      medication: med.full,
      dosage: med.full
    });
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-slate-400 text-sm font-medium tracking-wide uppercase">Common Medications</span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {COMMON_MEDICATIONS.map((med) => (
          <Button
            key={med.short}
            onClick={() => handleMedClick(med)}
            className={`h-14 text-base font-bold ${med.color} text-white`}
          >
            {med.short}
          </Button>
        ))}
      </div>
    </div>
  );
}