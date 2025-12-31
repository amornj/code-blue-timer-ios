import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Heart, Activity, Syringe, Zap, RefreshCw } from 'lucide-react';

export default function EventLog({ events }) {
  const getIcon = (type) => {
    switch (type) {
      case 'start': return <Clock className="w-4 h-4 text-green-400" />;
      case 'cycle': return <RefreshCw className="w-4 h-4 text-amber-400" />;
      case 'rhythm': return <Activity className="w-4 h-4 text-blue-400" />;
      case 'adrenaline': return <Syringe className="w-4 h-4 text-red-400" />;
      case 'amiodarone': return <Syringe className="w-4 h-4 text-purple-400" />;
      case 'shock': return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'pulse': return <Heart className="w-4 h-4 text-pink-400" />;
      case 'compressor': return <RefreshCw className="w-4 h-4 text-amber-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'start': return 'border-green-600 bg-green-900/20';
      case 'cycle': return 'border-amber-600 bg-amber-900/20';
      case 'rhythm': return 'border-blue-600 bg-blue-900/20';
      case 'adrenaline': return 'border-red-600 bg-red-900/20';
      case 'amiodarone': return 'border-purple-600 bg-purple-900/20';
      case 'shock': return 'border-yellow-600 bg-yellow-900/20';
      case 'pulse': return 'border-pink-600 bg-pink-900/20';
      case 'compressor': return 'border-amber-600 bg-amber-900/20';
      default: return 'border-slate-600 bg-slate-900/20';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-slate-300 font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Event Log
        </h3>
      </div>
      
      <ScrollArea className="h-64 p-4">
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              No events recorded yet
            </div>
          ) : (
            [...events].reverse().map((event, index) => (
              <div 
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${getColor(event.type)}`}
              >
                <div className="mt-0.5">{getIcon(event.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{event.message}</div>
                  <div className="text-slate-400 text-xs mt-1">{event.timestamp}</div>
                </div>
                <div className="text-slate-500 text-xs font-mono whitespace-nowrap">
                  {event.cprTime}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}