import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Play, Square, AlertTriangle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';

import CPRTimer from '@/components/cpr/CPRTimer';
import CycleTracker from '@/components/cpr/CycleTracker';
import EventBanner from '@/components/cpr/EventBanner';
import RhythmSelector from '@/components/cpr/RhythmSelector';
import ShockButton from '@/components/cpr/ShockButton';
import EventLog from '@/components/cpr/EventLog';

const CYCLE_DURATION = 120; // 2 minutes in seconds

export default function CPRTracker() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
    };
    checkAuth();
  }, []);

  // Session state
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [cycleSeconds, setCycleSeconds] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [startTime, setStartTime] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [finalOutcome, setFinalOutcome] = useState('');

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
  
  // LUCAS device and doctor notes
  const [lucasActive, setLucasActive] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState('');

  // Event tracking
  const [events, setEvents] = useState([]);
  const [bannerEvents, setBannerEvents] = useState([]);

  // End session dialog
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
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
        label: lucasActive ? 'Resume Chest Compressor' : 'Change Compressor',
        timing: 'Every cycle',
        status: lucasActive ? 'pending' : (cycleComplete && compressorChanges < cycle ? 'active' : (compressorChanges >= cycle ? 'completed' : 'pending'))
      },
      {
        type: 'pulse',
        label: 'Pulse Check',
        timing: '< 10 seconds',
        status: cycleComplete && pulseChecks < cycle ? 'active' : (pulseChecks >= cycle ? 'completed' : 'pending')
      },
      {
        type: 'adrenaline',
        label: 'Adrenaline 1mg',
        timing: 'Every 2 cycles',
        status: adrenalineDue ? 'active' : 
                (cycle === 1 ? 'pending' : // Always pending on cycle 1
                 adrenalineCount >= expectedAdrenalineCount ? 'completed' : 'pending')
      },
      ...(amiodaroneTotal < 300 ? [{
        type: 'amiodarone',
        label: 'Amiodarone 300mg',
        timing: 'After cycle 3',
        dose: 300,
        status: amiodarone300Due ? 'active' : 'pending'
      }] : []),
      ...(amiodaroneTotal >= 300 && amiodaroneTotal < 450 ? [{
        type: 'amiodarone',
        label: 'Amiodarone 150mg',
        timing: 'After cycle 5',
        dose: 150,
        status: amiodarone150Due ? 'active' : 'pending'
      }] : [])
    ];
    
    setBannerEvents(newBannerEvents);
  }, [currentCycle, cycleSeconds, adrenalineCount, amiodaroneTotal, adrenalineDue, amiodarone300Due, amiodarone150Due, compressorChanges, pulseChecks, lucasActive]);

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
    setLucasActive(false);
    setDoctorNotes('');
  };

  const handleConfirmCompressorChange = () => {
    setCompressorChanges(prev => prev + 1);
    if (lucasActive) {
      setLucasActive(false);
      addEvent('compressor', `Resumed manual chest compressions (Cycle ${currentCycle})`);
    } else {
      addEvent('compressor', `Compressor changed (Cycle ${currentCycle})`);
    }
    // Don't move to next cycle here - only pulse check does that
  };

  const handleToggleLucas = () => {
    const newLucasState = !lucasActive;
    setLucasActive(newLucasState);
    if (newLucasState) {
      addEvent('compressor', 'LUCAS mechanical CPR device activated');
    } else {
      addEvent('compressor', 'LUCAS device deactivated - returned to manual compressions');
    }
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
    setSessionEnded(true);
    setFinalOutcome(outcome);
    
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
      doctor_notes: doctorNotes,
      notes
    };

    if (isAuthenticated) {
      await base44.entities.CPRSession.create(sessionData);
    }
    
    setShowEndDialog(false);
    setOutcome('');
    setNotes('');
  };

  const exportGuestPDF = () => {
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatOutcome = (outcome) => {
      switch (outcome) {
        case 'ROSC': return 'ROSC';
        case 'deceased': return 'Deceased';
        case 'VA_ECMO': return 'VA ECMO';
        case 'ongoing': return 'Ongoing';
        case 'transferred': return 'Transferred';
        default: return outcome || 'N/A';
      }
    };

    const outcomeText = sessionEnded && finalOutcome 
      ? formatOutcome(finalOutcome)
      : 'Ongoing - CPR in progress';

    const report = `
<!DOCTYPE html>
<html>
<head>
  <title>CPR Session Report</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; }
    h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 5px; font-size: 18px; margin: 0 0 10px 0; }
    h2 { color: #374151; font-size: 12px; margin: 10px 0 5px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0; }
    .summary-box { background: #f3f4f6; padding: 8px; border-radius: 4px; }
    .summary-box label { font-size: 9px; color: #6b7280; text-transform: uppercase; display: block; }
    .summary-box value { font-size: 14px; font-weight: bold; display: block; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9px; }
    th, td { padding: 4px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .compact-table { font-size: 8px; }
    .compact-table th, .compact-table td { padding: 2px 4px; }
  </style>
</head>
<body>
  <h1>🏥 CPR Session Report</h1>
  
  <div class="summary-grid">
    <div class="summary-box">
      <label>Start Time</label>
      <value>${startTime || 'N/A'}</value>
    </div>
    <div class="summary-box">
      <label>Duration</label>
      <value>${formatTime(totalSeconds)}</value>
    </div>
    <div class="summary-box">
      <label>Cycles</label>
      <value>${currentCycle}</value>
    </div>
    <div class="summary-box">
      <label>${sessionEnded && finalOutcome ? 'Outcome' : 'Current Rhythm'}</label>
      <value>${sessionEnded && finalOutcome ? outcomeText : (currentRhythm || 'N/A')}</value>
    </div>
  </div>

  ${!sessionEnded || !finalOutcome ? `
  <div style="margin: 8px 0; padding: 8px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; color: #92400e; font-size: 10px;">
    <strong>⚠️ CPR Effort Ongoing:</strong> This report was generated during an active CPR session. Final outcome has not been determined.
  </div>
  ` : ''}

  <h2>📊 Summary</h2>
  <table class="compact-table">
    <tr>
      <td><strong>Shocks:</strong> ${shockCount}</td>
      <td><strong>Adrenaline:</strong> ${adrenalineCount} doses</td>
      <td><strong>Amiodarone:</strong> ${amiodaroneTotal} mg</td>
      <td><strong>Compressor Changes:</strong> ${compressorChanges}</td>
    </tr>
  </table>

  <h2>💉 Medications</h2>
  <table class="compact-table">
    <tr><th>Time</th><th>Medication</th><th>Dose</th><th>Cycle</th></tr>
    ${events.filter(e => e.type === 'adrenaline' || e.type === 'amiodarone').map(e => `
      <tr>
        <td>${e.cprTime}</td>
        <td>${e.type === 'adrenaline' ? 'Adrenaline' : 'Amiodarone'}</td>
        <td>${e.dose || '1'} mg</td>
        <td>${e.cycle || 'N/A'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">None</td></tr>'}
  </table>

  <h2>⚡ Defibrillation</h2>
  <table class="compact-table">
    <tr><th>Time</th><th>Shock #</th><th>Energy</th><th>Rhythm</th></tr>
    ${events.filter(e => e.type === 'shock').map((e, i) => `
      <tr>
        <td>${e.cprTime}</td>
        <td>${i + 1}</td>
        <td>${e.energy || 'N/A'}J</td>
        <td>${e.rhythmBefore || 'N/A'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">None</td></tr>'}
  </table>

  <h2>📋 Event Log</h2>
  <table class="compact-table">
    <tr><th>Time</th><th>Event</th><th>Details</th></tr>
    ${events.slice(0, 20).map(e => `
      <tr>
        <td>${e.cprTime}</td>
        <td>${e.type.toUpperCase()}</td>
        <td>${e.message}</td>
      </tr>
    `).join('')}
  </table>

  ${doctorNotes ? `
  <h2>📝 CPR Note</h2>
  <div style="padding: 8px; background: #f9fafb; border-radius: 4px; font-size: 9px; border: 1px solid #e5e7eb;">
    ${doctorNotes}
  </div>
  ` : ''}

  <p style="margin-top: 10px; color: #6b7280; font-size: 8px; text-align: center;">
    Generated: ${new Date().toLocaleString()} | CPR Tracker - ACLS Compliant
  </p>
</body>
</html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(report);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
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
            {totalSeconds === 0 ? (
              <Button 
                onClick={handleStart}
                className="bg-green-600 hover:bg-green-700 text-white px-6 h-12 text-lg font-semibold"
              >
                <Play className="w-5 h-5 mr-2" />
                Start CPR
              </Button>
            ) : sessionEnded ? (
              <Button 
                disabled
                className="bg-slate-700 text-slate-400 px-6 h-12 text-lg font-semibold cursor-not-allowed"
              >
                <Square className="w-5 h-5 mr-2" />
                Session Ended
              </Button>
            ) : (
              <Button 
                onClick={() => setShowConfirmEnd(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 h-12 text-lg font-semibold"
              >
                <Square className="w-5 h-5 mr-2" />
                End Session
              </Button>
            )}

            <Button 
              onClick={exportGuestPDF}
              variant="outline"
              className="border-blue-600 text-blue-400 hover:bg-blue-900/50 h-12"
              disabled={totalSeconds === 0}
            >
              <FileText className="w-5 h-5 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Timer and Cycle Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CPRTimer seconds={totalSeconds} />
          <CycleTracker 
            cycle={currentCycle} 
            cycleSeconds={cycleSeconds}
            shockCount={shockCount}
            adrenalineCount={adrenalineCount}
            amiodaroneTotal={amiodaroneTotal}
          />
        </div>

        {/* Rhythm Selector */}
        <RhythmSelector 
          currentRhythm={currentRhythm} 
          onRhythmChange={handleRhythmChange}
          onShockDelivered={handleShockDelivered}
          shockCount={shockCount}
        />

        {/* Event Banners */}
        <EventBanner 
          events={bannerEvents}
          onConfirmCompressorChange={handleConfirmCompressorChange}
          onConfirmPulseCheck={handleConfirmPulseCheck}
          onConfirmAdrenaline={handleConfirmAdrenaline}
          onConfirmAmiodarone={handleConfirmAmiodarone}
        />

        {/* LUCAS and Notes Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-300 font-semibold flex items-center gap-2">
                  🤖 LUCAS Device
                </h3>
                <p className="text-xs text-slate-500 mt-1">Mechanical chest compression</p>
              </div>
              <Button
                onClick={handleToggleLucas}
                className={`${
                  lucasActive 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-slate-700 hover:bg-slate-600'
                } text-white font-semibold px-6`}
              >
                {lucasActive ? '✓ LUCAS Active' : 'Start LUCAS'}
              </Button>
            </div>
            {lucasActive && (
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-3 text-green-300 text-sm">
                ✓ Mechanical compressions active - Manual compressor changes disabled
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <label className="text-slate-300 font-semibold mb-2 block">
              📝 Notes
            </label>
            <textarea
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value.slice(0, 200))}
              placeholder="text"
              maxLength={200}
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="text-xs text-slate-500 mt-1 text-right">
              {doctorNotes.length}/200 characters
            </div>
          </div>
        </div>

        {/* Event Log */}
        <EventLog events={events} />
      </div>

      {/* Confirm End Session Dialog */}
      <Dialog open={showConfirmEnd} onOpenChange={setShowConfirmEnd}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Confirm Stop CPR
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-4 text-amber-300 text-sm">
              <p className="font-semibold mb-2">⚠️ Are you sure you want to stop the CPR session?</p>
              <p className="text-sm">You will need to enter the outcome of this session.</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmEnd(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowConfirmEnd(false);
                  setShowEndDialog(true);
                }}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                {isAuthenticated ? 'End & Save Session' : 'End Session'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}