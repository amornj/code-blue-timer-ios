import React from 'react';
import { Button } from '@/components/ui/button';
import { Heart, Activity, Syringe, Zap, Check, AlertTriangle } from 'lucide-react';

export default function EventBanner({ 
  events, 
  onConfirmCompressorChange,
  onConfirmPulseCheck,
  onConfirmAdrenaline,
  onConfirmAmiodarone
}) {
  const getIcon = (type) => {
    switch (type) {
      case 'compressor': return <RefreshIcon />;
      case 'pulse': return <Activity className="w-6 h-6" />;
      case 'adrenaline': return <Syringe className="w-6 h-6" />;
      case 'amiodarone': return <Zap className="w-6 h-6" />;
      default: return <AlertTriangle className="w-6 h-6" />;
    }
  };

  const getColors = (type, status) => {
    if (status === 'completed') return 'bg-green-900/30 border-green-600 text-green-400';
    if (status === 'pending') return 'bg-slate-800 border-slate-600 text-slate-400';
    
    switch (type) {
      case 'compressor': return 'bg-amber-900/50 border-amber-500 text-amber-300';
      case 'pulse': return 'bg-blue-900/50 border-blue-500 text-blue-300';
      case 'adrenaline': return 'bg-red-900/50 border-red-500 text-red-300';
      case 'amiodarone': return 'bg-purple-900/50 border-purple-500 text-purple-300';
      default: return 'bg-slate-800 border-slate-600 text-slate-400';
    }
  };

  const getButtonColors = (type) => {
    switch (type) {
      case 'compressor': return 'bg-amber-600 hover:bg-amber-700';
      case 'pulse': return 'bg-blue-600 hover:bg-blue-700';
      case 'adrenaline': return 'bg-red-600 hover:bg-red-700';
      case 'amiodarone': return 'bg-purple-600 hover:bg-purple-700';
      default: return 'bg-slate-600 hover:bg-slate-700';
    }
  };

  const handleConfirm = (event) => {
    switch (event.type) {
      case 'compressor': onConfirmCompressorChange(); break;
      case 'pulse': onConfirmPulseCheck(); break;
      case 'adrenaline': onConfirmAdrenaline(); break;
      case 'amiodarone': onConfirmAmiodarone(event.dose); break;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      {events.map((event, index) => (
        <div 
          key={index}
          className={`rounded-xl p-4 border-2 transition-all duration-300 ${getColors(event.type, event.status)} ${
            event.status === 'active' ? 'animate-pulse shadow-lg' : ''
          }`}
        >
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-2 rounded-full bg-black/20">
              {event.type === 'compressor' ? <Heart className="w-6 h-6" /> : getIcon(event.type)}
            </div>
            <div className="font-semibold text-sm">{event.label}</div>
            <div className="text-xs opacity-75">{event.timing}</div>
            
            {event.status === 'active' && (
              <Button 
                size="sm" 
                className={`mt-2 w-full ${getButtonColors(event.type)} text-white font-bold`}
                onClick={() => handleConfirm(event)}
              >
                <Check className="w-4 h-4 mr-1" /> Confirm
              </Button>
            )}
            
            {event.status === 'completed' && (
              <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
                <Check className="w-4 h-4" /> Done
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}