import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pill } from 'lucide-react';

const PREDEFINED_MEDICATIONS = [
  '7.5% Sodium bicarbonate (NaHCO₃)',
  '10% Calcium chloride',
  '10% Calcium gluconate',
  '50% Glucose (50 mL)',
  '10% Magnesium sulfate (MgSO₄)',
  '50% Magnesium sulfate (MgSO₄)',
  'Custom / Other medication'
];

export default function DiscretionaryMedication({ onAddMedication }) {
  const [selectedMed, setSelectedMed] = useState('');
  const [customMedName, setCustomMedName] = useState('');
  const [dosage, setDosage] = useState('');

  const handleConfirm = () => {
    const medName = selectedMed === 'Custom / Other medication' ? customMedName : selectedMed;
    
    if (!medName || !dosage) return;

    onAddMedication({
      medication: medName,
      dosage: dosage
    });

    // Reset form
    setSelectedMed('');
    setCustomMedName('');
    setDosage('');
  };

  const isCustom = selectedMed === 'Custom / Other medication';
  const canConfirm = dosage && (isCustom ? customMedName : selectedMed);

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Pill className="w-5 h-5 text-indigo-400" />
        <h3 className="text-slate-300 font-semibold">Discretionary Medication</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">Record non-protocol medications (documentation only)</p>

      <div className="space-y-3">
        <div>
          <label className="text-slate-400 text-sm mb-2 block">Medication</label>
          <Select value={selectedMed} onValueChange={setSelectedMed}>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
              <SelectValue placeholder="Select medication..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-64">
              {PREDEFINED_MEDICATIONS.map((med) => (
                <SelectItem 
                  key={med} 
                  value={med}
                  className="text-white hover:bg-slate-700"
                >
                  {med}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCustom && (
          <div>
            <label className="text-slate-400 text-sm mb-2 block">Custom Medication Name</label>
            <Input
              value={customMedName}
              onChange={(e) => setCustomMedName(e.target.value)}
              placeholder="Enter medication name"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        )}

        <div>
          <label className="text-slate-400 text-sm mb-2 block">Dosage</label>
          <Input
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="e.g., 50 mL, 1 amp, 10 mg"
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        <Button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Confirm & Add
        </Button>
      </div>
    </div>
  );
}