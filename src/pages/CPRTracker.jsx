import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Play, Square, AlertTriangle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import CPRTimer from '@/components/cpr/CPRTimer';
import CycleTracker from '@/components/cpr/CycleTracker';
import EventBanner from '@/components/cpr/EventBanner';
import RhythmSelector from '@/components/cpr/RhythmSelector';
import ShockButton from '@/components/cpr/ShockButton';
import EventLog from '@/components/cpr/EventLog';
import DiscretionaryMedication from '@/components/cpr/DiscretionaryMedication';

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
  const [initialRhythm, setInitialRhythm] = useState(null);
  const [shockCount, setShockCount] = useState(0);
  const [shocksInCurrentShockableRhythm, setShocksInCurrentShockableRhythm] = useState(0);
  const [cyclesWithShocks, setCyclesWithShocks] = useState(new Set()); // Track cycles where shocks were delivered
  const [shockDeliveredThisCycle, setShockDeliveredThisCycle] = useState(false);
  const [adrenalineCount, setAdrenalineCount] = useState(0);
  const [amiodaroneTotal, setAmiodaroneTotal] = useState(0);
  const [compressorChanges, setCompressorChanges] = useState(0);
  const [pulseChecks, setPulseChecks] = useState(0);
  
  // Adrenaline frequency and tracking
  const [adrenalineFrequency, setAdrenalineFrequency] = useState(4); // 3, 4, or 5 minutes
  const [lastAdrenalineTime, setLastAdrenalineTime] = useState(null);
  
  // Track which medications are due
  const [adrenalineDue, setAdrenalineDue] = useState(false);
  const [amiodarone300Due, setAmiodarone300Due] = useState(false);
  const [amiodarone150Due, setAmiodarone150Due] = useState(false);
  
  // Lidocaine tracking
  const [lidocaineCumulativeDose, setLidocaineCumulativeDose] = useState(0); // in mg/kg
  const [lastLidocaineTime, setLastLidocaineTime] = useState(null);
  const [lidocaine1mgDue, setLidocaine1mgDue] = useState(false);
  const [lidocaine05mgDue, setLidocaine05mgDue] = useState(false);
  
  // LUCAS device and doctor notes
  const [lucasActive, setLucasActive] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState('');
  
  // Discretionary medications
  const [discretionaryMeds, setDiscretionaryMeds] = useState([]);

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
    const cyclesWithDefib = cyclesWithShocks.size;
    
    // Check rhythm types
    const isShockable = currentRhythm === 'VF' || currentRhythm === 'pVT';
    const isPEAorAsystole = currentRhythm === 'PEA' || currentRhythm === 'Asystole';
    const isFirstCycle = cycle === 1;
    
    // Check adrenaline timing
    const timeSinceLastAdrenaline = lastAdrenalineTime ? totalSeconds - lastAdrenalineTime : null;
    const adrenalineIntervalSeconds = adrenalineFrequency * 60; // Convert minutes to seconds
    
    // Adrenaline rules:
    // - VF/pVT: First dose after 2nd shock, then every 3-5 minutes based on frequency
    // - PEA/Asystole: First dose at 1st minute (60s), then every 3-5 minutes based on frequency
    // - Crossover: maintain interval regardless of rhythm change
    const shouldShowAdrenaline = adrenalineCount === 0 
      ? (isPEAorAsystole ? totalSeconds >= 60 : isShockable ? shockCount >= 2 : false)
      : (timeSinceLastAdrenaline !== null && timeSinceLastAdrenaline >= adrenalineIntervalSeconds);
    
    if (shouldShowAdrenaline && !adrenalineDue) {
      setAdrenalineDue(true);
    }
    
    // Check amiodarone timing - only for shockable rhythms
    // Amiodarone rules:
    // - 300mg after 3rd shock (when in shockable rhythm)
    // - 150mg after 5th shock (when in shockable rhythm)
    // - Max 450mg total per session
    if (isShockable && amiodaroneTotal < 450) {
      if (shockCount >= 3 && amiodaroneTotal < 300) {
        setAmiodarone300Due(true);
      }
      if (shockCount >= 5 && amiodaroneTotal >= 300 && amiodaroneTotal < 450) {
        setAmiodarone150Due(true);
      }
    }
    
    // Lidocaine (Xylocaine) rules
    // - 1.5 mg/kg after 8th shock (when in shockable rhythm)
    // - 0.75 mg/kg after 11th, 14th shock (when in shockable rhythm)
    // - Max 3 mg/kg total per session
    if (isShockable && lidocaineCumulativeDose < 3) {
      if (shockCount >= 8 && lidocaineCumulativeDose === 0) {
        setLidocaine1mgDue(true);
      }
      if (shockCount >= 11 && lidocaineCumulativeDose >= 1.5 && lidocaineCumulativeDose < 2.25) {
        setLidocaine05mgDue(true);
      }
      if (shockCount >= 14 && lidocaineCumulativeDose >= 2.25 && lidocaineCumulativeDose < 3) {
        setLidocaine05mgDue(true);
      }
    }
    
    // Determine adrenaline status
    let adrenalineStatus = 'pending';
    if (adrenalineDue) {
      adrenalineStatus = 'active';
    } else if (timeSinceLastAdrenaline !== null) {
      const timeUntilNext = adrenalineIntervalSeconds - timeSinceLastAdrenaline;
      if (timeUntilNext > 30) {
        adrenalineStatus = 'completed';
      }
    }
    
    const newBannerEvents = [
      {
        type: 'pulse',
        label: 'Pulse Check',
        timing: '< 10 seconds',
        status: cycleComplete && pulseChecks < cycle ? 'active' : (pulseChecks >= cycle ? 'completed' : 'pending')
      },
      {
        type: 'compressor',
        label: lucasActive ? 'Resume Chest Compressor' : 'Change Compressor',
        timing: 'Every cycle',
        status: lucasActive ? 'pending' : (cycleComplete && compressorChanges < cycle ? 'active' : (compressorChanges >= cycle ? 'completed' : 'pending'))
      },
      {
        type: 'adrenaline',
        label: 'Adrenaline 1mg',
        timing: `Every ${adrenalineFrequency} minutes`,
        status: adrenalineStatus,
        frequency: adrenalineFrequency
      },
      ...(isShockable && amiodaroneTotal < 300 ? [{
        type: 'amiodarone',
        label: 'Amiodarone 300mg',
        timing: 'After 3rd shock',
        dose: 300,
        status: amiodarone300Due ? 'active' : 'pending'
      }] : []),
      ...(isShockable && amiodaroneTotal >= 300 && amiodaroneTotal < 450 ? [{
        type: 'amiodarone',
        label: 'Amiodarone 150mg',
        timing: 'After 5th shock',
        dose: 150,
        status: amiodarone150Due ? 'active' : 'pending'
      }] : []),
      ...(isShockable && lidocaineCumulativeDose < 1.5 ? [{
        type: 'lidocaine',
        label: 'Xylocaine 1.5 mg/kg',
        timing: 'After 8th shock',
        dose: 1.5,
        status: lidocaine1mgDue ? 'active' : 'pending'
      }] : []),
      ...(isShockable && lidocaineCumulativeDose >= 1.5 && lidocaineCumulativeDose < 3 ? [{
        type: 'lidocaine',
        label: 'Xylocaine 0.75 mg/kg',
        timing: 'After 11th, 14th shock',
        dose: 0.75,
        status: lidocaine05mgDue ? 'active' : 'pending'
      }] : [])
    ];
    
    setBannerEvents(newBannerEvents);
  }, [currentCycle, cycleSeconds, totalSeconds, currentRhythm, adrenalineCount, adrenalineFrequency, lastAdrenalineTime, amiodaroneTotal, adrenalineDue, amiodarone300Due, amiodarone150Due, compressorChanges, pulseChecks, lucasActive, initialRhythm, lidocaineCumulativeDose, lastLidocaineTime, lidocaine1mgDue, lidocaine05mgDue, cyclesWithShocks]);

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
    setInitialRhythm(null);
    setShockCount(0);
    setShocksInCurrentShockableRhythm(0);
    setCyclesWithShocks(new Set());
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
    setAdrenalineFrequency(4);
    setLastAdrenalineTime(null);
    setLidocaineCumulativeDose(0);
    setLastLidocaineTime(null);
    setLidocaine1mgDue(false);
    setLidocaine05mgDue(false);
    setDiscretionaryMeds([]);
    setShockDeliveredThisCycle(false);
  };

  const handleConfirmCompressorChange = () => {
    const newCount = compressorChanges + 1;
    setCompressorChanges(newCount);
    if (lucasActive) {
      setLucasActive(false);
      addEvent('compressor', `Resumed manual chest compressions (Cycle ${currentCycle})`);
    } else {
      addEvent('compressor', `Compressor changed (Cycle ${currentCycle})`);
    }
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
    const newCount = pulseChecks + 1;
    setPulseChecks(newCount);
    addEvent('pulse', `Pulse check performed (Cycle ${currentCycle})`);
    // Move to next cycle only after pulse check
    setCurrentCycle(prev => prev + 1);
    setCycleSeconds(0);
    setShockDeliveredThisCycle(false); // Reset shock flag for new cycle
    addEvent('cycle', `Cycle ${currentCycle + 1} started`);
  };

  const handleConfirmAdrenaline = () => {
    setAdrenalineCount(prev => prev + 1);
    setLastAdrenalineTime(totalSeconds);
    setAdrenalineDue(false);
    addEvent('adrenaline', `Adrenaline 1mg administered (Dose #${adrenalineCount + 1})`, { dose: 1 });
  };

  const handleAdrenalineFrequencyChange = (newFrequency) => {
    setAdrenalineFrequency(newFrequency);
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

  const handleConfirmLidocaine = (dose) => {
    setLidocaineCumulativeDose(prev => prev + dose);
    setLastLidocaineTime(totalSeconds);
    if (dose === 1.5) {
      setLidocaine1mgDue(false);
    } else if (dose === 0.75) {
      setLidocaine05mgDue(false);
    }
    addEvent('lidocaine', `Xylocaine ${dose} mg/kg administered (cumulative: ${lidocaineCumulativeDose + dose} mg/kg)`, { dose });
  };

  const handleAddDiscretionaryMed = ({ medication, dosage }) => {
    const medEntry = {
      medication,
      dosage,
      cycle: currentCycle,
      timestamp: new Date().toLocaleTimeString(),
      cprTime: formatCPRTime(totalSeconds)
    };
    setDiscretionaryMeds(prev => [...prev, medEntry]);
    addEvent('discretionary_med', `${medication} - ${dosage} administered`, { medication, dosage });
  };

  const handleRhythmChange = (rhythm) => {
    const prevRhythm = currentRhythm;
    setCurrentRhythm(rhythm);
    
    // Track initial rhythm
    if (!initialRhythm) {
      setInitialRhythm(rhythm);
    }
    
    // Reset shock counter and cycles with shocks when transitioning to shockable rhythm from non-shockable
    const prevWasNonShockable = !prevRhythm || prevRhythm === 'PEA' || prevRhythm === 'Asystole' || prevRhythm === 'Sinus';
    const nowIsShockable = rhythm === 'VF' || rhythm === 'pVT';
    
    if (prevWasNonShockable && nowIsShockable) {
      setShocksInCurrentShockableRhythm(0);
      setCyclesWithShocks(new Set());
    }
    
    addEvent('rhythm', `Rhythm identified: ${rhythm}${prevRhythm ? ` (was ${prevRhythm})` : ''}`);
  };

  const handleShockDelivered = (energy) => {
    setShockCount(prev => prev + 1);
    setShocksInCurrentShockableRhythm(prev => prev + 1);
    
    // Track that this cycle had a shock (for medication timing)
    setCyclesWithShocks(prev => new Set([...prev, currentCycle]));
    setShockDeliveredThisCycle(true);
    
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
      lidocaine_doses: events.filter(e => e.type === 'lidocaine').map((e, i) => ({
        dose_number: i + 1,
        dose_mg_per_kg: e.dose,
        cycle: e.cycle,
        timestamp: e.timestamp
      })),
      discretionary_medications: discretionaryMeds,
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
        case 'ROSC_following': return 'ROSC, and following command';
        case 'ROSC_not_following': return 'ROSC, not following command';
        case 'death': return 'Death';
        case 'VA_ECMO': return 'Transit to VA ECMO';
        case 'transfer_ICU': return 'Transfer to ICU or other hospital';
        // Legacy support
        case 'ROSC': return 'ROSC';
        case 'deceased': return 'Deceased';
        case 'ongoing': return 'Ongoing';
        case 'transferred': return 'Transferred';
        default: return outcome || 'N/A';
      }
    };

    const outcomeText = sessionEnded && finalOutcome 
      ? formatOutcome(finalOutcome)
      : 'Ongoing - CPR in progress';

    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175);
    doc.text('CPR Session Report', 15, yPos);
    yPos += 12;

    // Summary boxes
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Start: ${startTime || 'N/A'}`, 15, yPos);
    doc.text(`Duration: ${formatTime(totalSeconds)}`, 70, yPos);
    doc.text(`Cycles: ${currentCycle}`, 125, yPos);
    yPos += 6;
    doc.text(`${sessionEnded && finalOutcome ? 'Outcome' : 'Rhythm'}: ${outcomeText}`, 15, yPos);
    yPos += 10;

    // Warning if ongoing
    if (!sessionEnded || !finalOutcome) {
      doc.setFillColor(254, 243, 199);
      doc.rect(15, yPos, 180, 10, 'F');
      doc.setFontSize(9);
      doc.text('Warning: CPR Effort Ongoing - Final outcome not determined', 20, yPos + 6);
      yPos += 15;
    }

    // Summary
    doc.setFontSize(11);
    doc.text('Summary', 15, yPos);
    yPos += 6;
    doc.setFontSize(9);
    doc.text(`Shocks: ${shockCount} | Adrenaline: ${adrenalineCount} | Amiodarone: ${amiodaroneTotal}mg | Lidocaine: ${lidocaineCumulativeDose} mg/kg | Compressor Changes: ${compressorChanges}`, 15, yPos);
    yPos += 10;

    // Medications Table
    const medEvents = events.filter(e => e.type === 'adrenaline' || e.type === 'amiodarone' || e.type === 'lidocaine' || e.type === 'discretionary_med');
    if (medEvents.length > 0) {
      doc.setFontSize(11);
      doc.text('Medications', 15, yPos);
      yPos += 5;
      doc.autoTable({
        startY: yPos,
        head: [['Time', 'Medication', 'Dose', 'Cycle']],
        body: medEvents.map(e => [
          e.cprTime,
          e.type === 'adrenaline' ? 'Adrenaline' : 
          e.type === 'amiodarone' ? 'Amiodarone' : 
          e.type === 'lidocaine' ? 'Lidocaine' : 
          e.medication || 'Other',
          e.type === 'lidocaine' ? `${e.dose} mg/kg` : 
          e.type === 'discretionary_med' ? e.dosage :
          `${e.dose || 1} mg`,
          e.cycle || 'N/A'
        ]),
        theme: 'striped',
        styles: { fontSize: 8 },
        margin: { left: 15 }
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // Defibrillation Table
    const shockEvents = events.filter(e => e.type === 'shock');
    if (shockEvents.length > 0 && yPos < 250) {
      doc.setFontSize(11);
      doc.text('Defibrillation', 15, yPos);
      yPos += 5;
      doc.autoTable({
        startY: yPos,
        head: [['Time', 'Shock #', 'Energy', 'Rhythm']],
        body: shockEvents.map((e, i) => [
          e.cprTime,
          i + 1,
          `${e.energy || 'N/A'}J`,
          e.rhythmBefore || 'N/A'
        ]),
        theme: 'striped',
        styles: { fontSize: 8 },
        margin: { left: 15 }
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // Event Log
    if (events.length > 0 && yPos < 250) {
      doc.setFontSize(11);
      doc.text('Event Log (Recent)', 15, yPos);
      yPos += 5;
      doc.autoTable({
        startY: yPos,
        head: [['Time', 'Event', 'Details']],
        body: events.slice(0, 15).map(e => [
          e.cprTime,
          e.type.toUpperCase(),
          e.message
        ]),
        theme: 'striped',
        styles: { fontSize: 7 },
        margin: { left: 15 }
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // Note1 - During CPR
    if (doctorNotes && yPos < 270) {
      doc.setFontSize(11);
      doc.text('Note1', 15, yPos);
      yPos += 5;
      doc.setFontSize(8);
      const splitNotes = doc.splitTextToSize(doctorNotes, 180);
      doc.text(splitNotes, 15, yPos);
      yPos += splitNotes.length * 4 + 5;
    }

    // Note2 - End session notes
    if (notes && yPos < 270) {
      doc.setFontSize(11);
      doc.text('Note2', 15, yPos);
      yPos += 5;
      doc.setFontSize(8);
      const splitNote2 = doc.splitTextToSize(notes, 180);
      doc.text(splitNote2, 15, yPos);
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${new Date().toLocaleString()} | CPR Tracker - ACLS Compliant`, 105, 285, { align: 'center' });

    // Download PDF
    const fileName = `CPR_Session_${new Date().toISOString().slice(0, 10)}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
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
        <CycleTracker 
          cycle={currentCycle} 
          cycleSeconds={cycleSeconds}
          totalSeconds={totalSeconds}
          shockCount={shockCount}
          adrenalineCount={adrenalineCount}
          amiodaroneTotal={amiodaroneTotal}
          lidocaineCumulativeDose={lidocaineCumulativeDose}
        />

        {/* Rhythm Selector */}
        <RhythmSelector 
          currentRhythm={currentRhythm} 
          onRhythmChange={handleRhythmChange}
          onShockDelivered={handleShockDelivered}
          shockCount={shockCount}
          shockDeliveredThisCycle={shockDeliveredThisCycle}
        />

        {/* Event Banners */}
        <EventBanner 
          events={bannerEvents}
          onConfirmCompressorChange={handleConfirmCompressorChange}
          onConfirmPulseCheck={handleConfirmPulseCheck}
          onConfirmAdrenaline={handleConfirmAdrenaline}
          onConfirmAmiodarone={handleConfirmAmiodarone}
          onConfirmLidocaine={handleConfirmLidocaine}
          onAdrenalineFrequencyChange={handleAdrenalineFrequencyChange}
          lucasActive={lucasActive}
          onToggleLucas={handleToggleLucas}
        />

        {/* Event Log */}
        <EventLog events={events} />

        {/* Discretionary Medication Section */}
        <div className="grid grid-cols-1 gap-6">
          <DiscretionaryMedication onAddMedication={handleAddDiscretionaryMed} />
        </div>

            {/* Notes Section */}
            <div className="grid grid-cols-1 gap-6">
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
        <DialogContent className="bg-slate-100 border-slate-300 text-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              End CPR Session
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-base font-medium text-slate-700 mb-3 block">Outcome</label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="bg-white border-slate-300 text-base h-12">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-300">
                  <SelectItem value="ROSC_following" className="text-base py-3">ROSC, and following command</SelectItem>
                  <SelectItem value="ROSC_not_following" className="text-base py-3">ROSC, not following command</SelectItem>
                  <SelectItem value="death" className="text-base py-3">Death</SelectItem>
                  <SelectItem value="VA_ECMO" className="text-base py-3">Transit to VA ECMO</SelectItem>
                  <SelectItem value="transfer_ICU" className="text-base py-3">Transfer to ICU or other hospital</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-base font-medium text-slate-700 mb-2 block">Notes</label>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the session..."
                className="bg-white border-slate-300 min-h-24"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowEndDialog(false)}
                className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEndSession}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
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