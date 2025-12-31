import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Play, Square, RotateCcw, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

import CPRTimer from '@/components/cpr/CPRTimer';
import CycleTracker from '@/components/cpr/CycleTracker';
import EventBanner from '@/components/cpr/EventBanner';
import RhythmSelector from '@/components/cpr/RhythmSelector';
import ShockButton from '@/components/cpr/ShockButton';
import EventLog from '@/components/cpr/EventLog';
import PDFExport from '@/components/cpr/PDFExport';

const CYCLE_DURATION = 120; // 2 minutes in seconds

export default function CPRTracker() {
  // Session state
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [cycleSeconds, setCycleSeconds] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [startTime, setStartTime] = useState(null);

  // Clinical state
  const [currentRhythm, setCurrentRhythm] = useState(null);
  const [shockCount, setShockCount] = useState(0);
  const [adrenalineCount, setAdrenalineCount] = useState(0);
  const [amiodaroneTotal, setAmiodaroneTotal] = useState(0);
  const [compressorChanges, setCompressorChanges] = useState(0);
  const [pulseChecks, setPulseChecks] = useState(0);
  
  // Track which medications are due
  const [adrenalineDue, setAdrenalineDue] = useState(false);
  const [amiodarone300Due, setAmiodarone300Due] = useState(false);
  const [amiodarone150Due, setAmiodarone150Due] = useState(false);

  // Event tracking
  const [events, setEvents] = useState([]);
  const [bannerEvents, setBannerEvents] = useState([]);

  // End session dialog
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');

  // Audio ref
  const audioRef = useRef(null);

  const formatCPRTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const addEvent = useCallback((type, message, extra = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    const cprTime = formatCPRTime(totalSeconds);
    setEvents(prev => [...prev, { type, message, timestamp, cprTime, cycle: currentCycle, ...extra }]);
  }, [totalSeconds, currentCycle, formatCPRTime]);

  // Update banner events based on cycle and medication status
  useEffect(() => {
    const cycle = currentCycle;
    const cycleComplete = cycleSeconds >= CYCLE_DURATION - 5;
    
    // Check if medications should become due
    if (cycle % 2 === 0 && cycleComplete && adrenalineCount < Math.floor(cycle / 2)) {
      setAdrenalineDue(true);
    }
    if (cycle >= 3 && cycleComplete && amiodaroneTotal < 300) {
      setAmiodarone300Due(true);
    }
    if (cycle >= 5 && cycleComplete && amiodaroneTotal >= 300 && amiodaroneTotal < 450) {
      setAmiodarone150Due(true);
    }
    
    // Calculate expected adrenaline count for current cycle
    const expectedAdrenalineCount = Math.floor(cycle / 2);
    
    const newBannerEvents = [
      {
        type: 'compressor',
        label: 'Change Compressor',
        timing: 'Every cycle',
        status: cycleComplete ? 'active' : 'pending'
      },
      {
        type: 'pulse',
        label: 'Pulse Check',
        timing: '< 10 seconds',
        status: cycleComplete ? 'active' : 'pending'
      },
      {
        type: 'adrenaline',
        label: 'Adrenaline 1mg',
        timing: 'Every 2 cycles',
        status: adrenalineDue ? 'active' : 
                (cycle === 1 ? 'pending' : // Always pending on cycle 1
                 adrenalineCount >= expectedAdrenalineCount ? 'completed' : 'pending')
      },
      {
        type: 'amiodarone',
        label: 'Amiodarone 300mg',
        timing: 'After cycle 3',
        dose: 300,
        status: amiodarone300Due ? 'active' : 
                (amiodaroneTotal >= 300 ? 'completed' : 'pending')
      },
      {
        type: 'amiodarone',
        label: 'Amiodarone 150mg',
        timing: 'After cycle 5',
        dose: 150,
        status: amiodarone150Due ? 'active' : 
                (amiodaroneTotal >= 450 ? 'completed' : 'pending')
      }
    ];
    
    setBannerEvents(newBannerEvents);
  }, [currentCycle, cycleSeconds, adrenalineCount, amiodaroneTotal, adrenalineDue, amiodarone300Due, amiodarone150Due]);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setTotalSeconds(prev => prev + 1);
        setCycleSeconds(prev => {
          const newSeconds = prev + 1;
          if (newSeconds >= CYCLE_DURATION) {
            // Play alert sound
            if (audioRef.current) {
              audioRef.current.play().catch(() => {});
            }
            return CYCLE_DURATION;
          }
          return newSeconds;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStart = () => {
    if (!isRunning && totalSeconds === 0) {
      const now = new Date();
      setStartTime(now.toLocaleString());
      addEvent('start', 'CPR Session Started');
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTotalSeconds(0);
    setCycleSeconds(0);
    setCurrentCycle(1);
    setCurrentRhythm(null);
    setShockCount(0);
    setAdrenalineCount(0);
    setAmiodaroneTotal(0);
    setCompressorChanges(0);
    setPulseChecks(0);
    setEvents([]);
    setStartTime(null);
    setAdrenalineDue(false);
    setAmiodarone300Due(false);
    setAmiodarone150Due(false);
  };

  const handleConfirmCompressorChange = () => {
    setCompressorChanges(prev => prev + 1);
    addEvent('compressor', `Compressor changed (Cycle ${currentCycle})`);
  };

  const handleConfirmPulseCheck = () => {
    setPulseChecks(prev => prev + 1);
    addEvent('pulse', `Pulse check performed (Cycle ${currentCycle})`);
    // Move to next cycle
    setCurrentCycle(prev => prev + 1);
    setCycleSeconds(0);
    addEvent('cycle', `Cycle ${currentCycle + 1} started`);
  };

  const handleConfirmAdrenaline = () => {
    setAdrenalineCount(prev => prev + 1);
    setAdrenalineDue(false);
    addEvent('adrenaline', `Adrenaline 1mg administered (Dose #${adrenalineCount + 1})`, { dose: 1 });
  };

  const handleConfirmAmiodarone = (dose) => {
    setAmiodaroneTotal(prev => prev + dose);
    if (dose === 300) {
      setAmiodarone300Due(false);
    } else if (dose === 150) {
      setAmiodarone150Due(false);
    }
    addEvent('amiodarone', `Amiodarone ${dose}mg administered`, { dose });
  };

  const handleRhythmChange = (rhythm) => {
    const prevRhythm = currentRhythm;
    setCurrentRhythm(rhythm);
    addEvent('rhythm', `Rhythm identified: ${rhythm}${prevRhythm ? ` (was ${prevRhythm})` : ''}`);
  };

  const handleShockDelivered = (energy) => {
    setShockCount(prev => prev + 1);
    addEvent('shock', `Shock delivered @ ${energy}J (Shock #${shockCount + 1})`, { 
      energy, 
      rhythmBefore: currentRhythm 
    });
  };

  const handleEndSession = async () => {
    setIsRunning(false);
    
    const sessionData = {
      start_time: startTime,
      end_time: new Date().toISOString(),
      total_duration_seconds: totalSeconds,
      total_cycles: currentCycle,
      rhythm_history: events.filter(e => e.type === 'rhythm').map(e => ({
        cycle: e.cycle,
        rhythm: e.message.replace('Rhythm identified: ', '').split(' ')[0],
        timestamp: e.timestamp
      })),
      adrenaline_doses: events.filter(e => e.type === 'adrenaline').map((e, i) => ({
        dose_number: i + 1,
        dose_mg: 1,
        cycle: e.cycle,
        timestamp: e.timestamp
      })),
      shocks_delivered: events.filter(e => e.type === 'shock').map((e, i) => ({
        shock_number: i + 1,
        energy_joules: e.energy,
        cycle: e.cycle,
        rhythm_before: e.rhythmBefore,
        timestamp: e.timestamp
      })),
      compressor_changes: events.filter(e => e.type === 'compressor').map(e => ({
        cycle: e.cycle,
        timestamp: e.timestamp
      })),
      pulse_checks: events.filter(e => e.type === 'pulse').map(e => ({
        cycle: e.cycle,
        duration_seconds: 10,
        timestamp: e.timestamp
      })),
      amiodarone_doses: events.filter(e => e.type === 'amiodarone').map((e, i) => ({
        dose_number: i + 1,
        dose_mg: e.dose,
        cycle: e.cycle,
        timestamp: e.timestamp
      })),
      outcome,
      notes
    };

    await base44.entities.CPRSession.create(sessionData);
    setShowEndDialog(false);
    setOutcome('');
    setNotes('');
    handleReset();
    window.location.reload();
  };

  const isShockable = currentRhythm === 'VF' || currentRhythm === 'pVT';

  const sessionSummary = {
    startTime,
    totalSeconds,
    totalCycles: currentCycle,
    currentRhythm,
    shockCount,
    adrenalineCount,
    amiodaroneTotal,
    compressorChanges,
    pulseChecks
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      {/* Hidden audio element for alerts */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleXFxgXhre25ycGpmc2llTj1IXHiLlot9cWdiYW9/jIyGgYGEh4eDenNyfH2BeXBnYGZpb3V6fHx7fIKHjIqDe3Rva3B3foSKjoWBeYCGkpqWinpqbnh+hIuUl5WVl5qYko1+b2dndYWQmJmUjomKj5eajYB6fIWSmZiOgXp9h5CRhHRvdoSQmZqOgnl4gIiKfnFyhZqrpY91YmNygoqNjYmHh42SmI+Ab21vd4OQnKGelYqAfoKGhHdubnV/iJKamJWTkpSSjYZ9dXBzeoaQmJmVjoeGipCUjoVybG10gY2Zn5yVjYmKjpGNgXRta3SDkJqdmJKNi46SlIp6" />
      
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              CPR Tracker
            </h1>
            <p className="text-slate-400 mt-1">ACLS Cardiac Arrest Protocol</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {!isRunning ? (
              <Button 
                onClick={handleStart}
                className="bg-green-600 hover:bg-green-700 text-white px-6 h-12 text-lg font-semibold"
              >
                <Play className="w-5 h-5 mr-2" />
                {totalSeconds === 0 ? 'Start CPR' : 'Resume'}
              </Button>
            ) : (
              <Button 
                onClick={handlePause}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 h-12 text-lg font-semibold"
              >
                <Square className="w-5 h-5 mr-2" />
                Pause
              </Button>
            )}
            
            <Button 
              onClick={() => setShowEndDialog(true)}
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-900/50 h-12"
              disabled={totalSeconds === 0}
            >
              End Session
            </Button>
            
            <Button 
              onClick={handleReset}
              variant="outline"
              className="border-slate-600 text-slate-400 hover:bg-slate-800 h-12"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>

            <PDFExport sessionData={sessionSummary} events={events} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Timer and Cycle Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CPRTimer seconds={totalSeconds} />
          <CycleTracker cycle={currentCycle} cycleSeconds={cycleSeconds} />
        </div>

        {/* Event Banners */}
        <EventBanner 
          events={bannerEvents}
          onConfirmCompressorChange={handleConfirmCompressorChange}
          onConfirmPulseCheck={handleConfirmPulseCheck}
          onConfirmAdrenaline={handleConfirmAdrenaline}
          onConfirmAmiodarone={handleConfirmAmiodarone}
        />

        {/* Rhythm and Shock Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RhythmSelector 
            currentRhythm={currentRhythm} 
            onRhythmChange={handleRhythmChange} 
          />
          
          <div className="space-y-4">
            <ShockButton 
              isShockable={isShockable}
              onShockDelivered={handleShockDelivered}
              shockCount={shockCount}
            />
            
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                <div className="text-3xl font-bold text-red-400">{adrenalineCount}</div>
                <div className="text-xs text-slate-400 mt-1">Adrenaline Doses</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                <div className="text-3xl font-bold text-purple-400">{amiodaroneTotal}</div>
                <div className="text-xs text-slate-400 mt-1">Amiodarone (mg)</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                <div className="text-3xl font-bold text-yellow-400">{shockCount}</div>
                <div className="text-xs text-slate-400 mt-1">Shocks</div>
              </div>
            </div>
          </div>
        </div>

        {/* Event Log */}
        <EventLog events={events} />
      </div>

      {/* End Session Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              End CPR Session
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Outcome</label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="ROSC">ROSC - Return of Spontaneous Circulation</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                  <SelectItem value="ongoing">Ongoing - Transferred</SelectItem>
                  <SelectItem value="transferred">Transferred to another team</SelectItem>
                  <SelectItem value="VA_ECMO">Transit to VA ECMO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Notes</label>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the session..."
                className="bg-slate-800 border-slate-700 min-h-24"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowEndDialog(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEndSession}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={!outcome}
              >
                End & Save Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}