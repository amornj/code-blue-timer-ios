import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, Activity, Syringe, Check, AlertTriangle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

export default function EventBanner({ 
  events, 
  onConfirmCompressorChange,
  onConfirmPulseCheck,
  onConfirmAdrenaline,
  onDismissAdrenaline,
  onConfirmAmiodarone,
  onDismissAmiodarone,
  onConfirmLidocaine,
  onDismissLidocaine,
  onAdrenalineFrequencyChange,
  onSyncPulseCheck,
  pulseCheckSynced,
  lucasActive,
  onToggleLucas,
  disabled = false
}) {
  const adrenalineRef = useRef(null);

  // Autoscroll to adrenaline banner when any alarm becomes active
  useEffect(() => {
    const hasActiveAlarm = events.some(e => e.status === 'active');
    if (hasActiveAlarm && adrenalineRef.current) {
      adrenalineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [events]);

  const getIcon = (type) => {
    switch (type) {
      case 'compressor': return <RefreshIcon />;
      case 'pulse': return <Activity className="w-6 h-6" />;
      case 'adrenaline': return <Syringe className="w-6 h-6" />;
      case 'amiodarone': return <IVBagIcon className="w-6 h-6" />;
      case 'lidocaine': return <Syringe className="w-6 h-6" />;
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
      case 'lidocaine': return 'bg-teal-900/50 border-teal-500 text-teal-300';
      default: return 'bg-slate-800 border-slate-600 text-slate-400';
    }
  };

  const getButtonColors = (type) => {
    switch (type) {
      case 'compressor': return 'bg-amber-600 hover:bg-amber-700';
      case 'pulse': return 'bg-blue-600 hover:bg-blue-700';
      case 'adrenaline': return 'bg-red-600 hover:bg-red-700';
      case 'amiodarone': return 'bg-purple-600 hover:bg-purple-700';
      case 'lidocaine': return 'bg-teal-600 hover:bg-teal-700';
      default: return 'bg-slate-600 hover:bg-slate-700';
    }
  };

  const handleConfirm = (event) => {
    switch (event.type) {
      case 'compressor': onConfirmCompressorChange(); break;
      case 'pulse': onConfirmPulseCheck(); break;
      case 'adrenaline': onConfirmAdrenaline(); break;
      case 'amiodarone': 
        // Pass event object if dose is null (track mode), otherwise pass dose directly
        onConfirmAmiodarone(event.dose === null ? event : event.dose); 
        break;
      case 'lidocaine': onConfirmLidocaine(event); break;
    }
  };

  const handleDismiss = (event) => {
    switch (event.type) {
      case 'adrenaline': onDismissAdrenaline(); break;
      case 'amiodarone': onDismissAmiodarone(event.dose); break;
      case 'lidocaine': onDismissLidocaine(event.dose); break;
    }
  };

  const isMedicationButton = (type) => {
    return ['adrenaline', 'amiodarone', 'lidocaine'].includes(type);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      {events.map((event, index) => (
        <div 
          key={index}
          ref={event.type === 'adrenaline' ? adrenalineRef : null}
          className={`rounded-xl p-4 border-2 transition-all duration-300 relative ${getColors(event.type, event.status)} ${
            event.status === 'active' ? 'animate-pulse shadow-lg' : ''
          }`}
        >
          {/* LUCAS Toggle for Compressor */}
          {event.type === 'compressor' && (
            <div className="absolute top-2 right-2 flex flex-col items-center gap-1 bg-black/30 rounded-lg px-2 py-2">
              <span className="text-xs font-medium">LUCAS</span>
              <Switch
                checked={lucasActive}
                onCheckedChange={onToggleLucas}
                disabled={disabled}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          )}

          {/* SYNC Button for Pulse Check */}
          {event.type === 'pulse' && (
            <div className="absolute top-2 right-2">
              <Button
                onClick={onSyncPulseCheck}
                disabled={disabled || pulseCheckSynced}
                size="sm"
                className={`h-7 px-3 text-xs font-semibold ${
                  pulseCheckSynced 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-slate-700/50 hover:bg-slate-600 text-slate-400 border border-slate-600'
                }`}
              >
                {pulseCheckSynced ? 'SYNCED' : 'SYNC'}
              </Button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center text-center gap-2 flex-1">
              <div className="p-2 rounded-full bg-black/20">
                {event.type === 'compressor' ? <Heart className="w-6 h-6" /> : getIcon(event.type)}
              </div>
              <div className="font-semibold text-sm">{event.label}</div>
              <div className="text-xs opacity-75">{event.timing}</div>
            
              {(event.status === 'active' || (event.status === 'pending' && isMedicationButton(event.type))) && (
                <div className="mt-2 w-full space-y-1">
                  <Button 
                    size="sm" 
                    className={`w-full ${event.status === 'active' ? getButtonColors(event.type) : 'bg-slate-600 hover:bg-slate-500'} text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed`}
                    onClick={() => handleConfirm(event)}
                    disabled={disabled}
                  >
                    <Check className="w-4 h-4 mr-1" /> {event.status === 'active' ? 'Confirm' : 'Give'}
                  </Button>
                  {event.status === 'active' && isMedicationButton(event.type) && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleDismiss(event)}
                      disabled={disabled}
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              )}
              
              {event.status === 'completed' && (
                <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
                  <Check className="w-4 h-4" /> Done
                </div>
              )}
            </div>
            
            {/* Frequency selector for adrenaline - right side */}
            {event.type === 'adrenaline' && (
              <div className="flex flex-col gap-1">
                {[3, 4, 5].map(freq => (
                  <button
                    key={freq}
                    onClick={() => onAdrenalineFrequencyChange(freq)}
                    disabled={disabled}
                    className={`w-7 h-7 rounded-md text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      event.frequency === freq
                        ? 'bg-black/40 text-white shadow-md border border-current'
                        : 'bg-black/20 text-current/60 hover:bg-black/30'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
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

function IVBagIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v1.5M15 3v1.5M9 4.5h6M8 8h8v12a2 2 0 01-2 2h-4a2 2 0 01-2-2V8zM10 12h4M10 15h4" />
    </svg>
  );
}