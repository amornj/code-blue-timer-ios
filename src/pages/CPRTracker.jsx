import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Play, Square, AlertTriangle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast, Toaster } from 'sonner';

import CPRTimer from '@/components/cpr/CPRTimer';
import CycleTracker from '@/components/cpr/CycleTracker';
import EventBanner from '@/components/cpr/EventBanner';
import RhythmSelector from '@/components/cpr/RhythmSelector';
import ShockButton from '@/components/cpr/ShockButton';
import EventLog from '@/components/cpr/EventLog';
import CommonMedications from '@/components/cpr/CommonMedications';
import CommonProcedures from '@/components/cpr/CommonProcedures';

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
  const [hasStarted, setHasStarted] = useState(false); // Track if CPR has been started
  const [soundEnabled, setSoundEnabled] = useState(false); // Sound toggle
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [cycleSeconds, setCycleSeconds] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [startTime, setStartTime] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [finalOutcome, setFinalOutcome] = useState('');

  // Clinical state
  const [currentRhythm, setCurrentRhythm] = useState(null);
  const [initialRhythm, setInitialRhythm] = useState(null);
  const [rhythmSelectionStage, setRhythmSelectionStage] = useState('unselected'); // 'unselected' or 'selected'
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
  
  // Track dismissed alarms
  const [adrenalineDismissed, setAdrenalineDismissed] = useState(false);
  const [amiodarone300Dismissed, setAmiodarone300Dismissed] = useState(false);
  const [amiodarone150Dismissed, setAmiodarone150Dismissed] = useState(false);
  const [lidocaine1mgDismissed, setLidocaine1mgDismissed] = useState(false);
  const [lidocaine05mgDismissed, setLidocaine05mgDismissed] = useState(false);
  
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
  const [medicationCounts, setMedicationCounts] = useState({});
  const [usedProcedures, setUsedProcedures] = useState([]);

  // Event tracking
  const [events, setEvents] = useState([]);
  const [bannerEvents, setBannerEvents] = useState([]);

  // End session dialog
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');

  // Audio context and refs
  const audioContextRef = useRef(null);
  const beepIntervalRef = useRef(null);

  // Initialize Web Audio API
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Function to play beep using Web Audio API
  const playBeep = useCallback((frequency = 800, duration = 100) => {
    if (!soundEnabled || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  }, [soundEnabled]);

  // Function to play thud (low frequency)
  const playThud = useCallback(() => {
    if (!soundEnabled || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 100;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  }, [soundEnabled]);

  // Function to play click (short high beep)
  const playClick = useCallback(() => {
    if (!soundEnabled || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 1200;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  }, [soundEnabled]);

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
    // - PEA/Asystole: First dose at 10 seconds, then every 3-5 minutes based on frequency
    // - Crossover: maintain interval regardless of rhythm change
    const shouldShowAdrenaline = adrenalineCount === 0 
      ? (isPEAorAsystole ? totalSeconds >= 10 : isShockable ? shockCount >= 2 : false)
      : (timeSinceLastAdrenaline !== null && timeSinceLastAdrenaline >= adrenalineIntervalSeconds);

    if (shouldShowAdrenaline && !adrenalineDue && !adrenalineDismissed) {
      setAdrenalineDue(true);
    }
    
    // Check amiodarone timing - only for shockable rhythms
    // Amiodarone rules:
    // - 300mg after 3rd shock (when in shockable rhythm)
    // - 150mg after 5th shock (when in shockable rhythm)
    // - Max 450mg total per session
    if (isShockable && amiodaroneTotal < 450) {
      if (shockCount >= 3 && amiodaroneTotal < 300 && !amiodarone300Dismissed) {
        setAmiodarone300Due(true);
      }
      if (shockCount >= 5 && amiodaroneTotal >= 300 && amiodaroneTotal < 450 && !amiodarone150Dismissed) {
        setAmiodarone150Due(true);
      }
    }
    
    // Lidocaine (Xylocaine) rules
    // - 1.5 mg/kg after 8th shock (when in shockable rhythm)
    // - 0.75 mg/kg after 11th, 14th shock (when in shockable rhythm)
    // - Max 3 mg/kg total per session
    if (isShockable && lidocaineCumulativeDose < 3) {
      if (shockCount >= 8 && lidocaineCumulativeDose === 0 && !lidocaine1mgDismissed) {
        setLidocaine1mgDue(true);
      }
      if (shockCount >= 11 && lidocaineCumulativeDose >= 1.5 && lidocaineCumulativeDose < 2.25 && !lidocaine05mgDismissed) {
        setLidocaine05mgDue(true);
      }
      if (shockCount >= 14 && lidocaineCumulativeDose >= 2.25 && lidocaineCumulativeDose < 3 && !lidocaine05mgDismissed) {
        setLidocaine05mgDue(true);
      }
    }
    
    // Determine adrenaline status
    let adrenalineStatus = 'pending';
    if (adrenalineDue) {
      adrenalineStatus = soundEnabled ? 'active' : 'pending';
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
        status: soundEnabled && amiodarone300Due ? 'active' : 'pending'
      }] : []),
      ...(isShockable && amiodaroneTotal >= 300 && amiodaroneTotal < 450 ? [{
        type: 'amiodarone',
        label: 'Amiodarone 150mg',
        timing: 'After 5th shock',
        dose: 150,
        status: soundEnabled && amiodarone150Due ? 'active' : 'pending'
      }] : []),
      ...(isShockable && lidocaineCumulativeDose < 1.5 ? [{
        type: 'lidocaine',
        label: 'Xylocaine 1.5 mg/kg',
        timing: 'After 8th shock',
        dose: 1.5,
        status: soundEnabled && lidocaine1mgDue ? 'active' : 'pending'
      }] : []),
      ...(isShockable && lidocaineCumulativeDose >= 1.5 && lidocaineCumulativeDose < 3 ? [{
        type: 'lidocaine',
        label: 'Xylocaine 0.75 mg/kg',
        timing: 'After 11th, 14th shock',
        dose: 0.75,
        status: soundEnabled && lidocaine05mgDue ? 'active' : 'pending'
      }] : [])
    ];
    
    setBannerEvents(newBannerEvents);
  }, [currentCycle, cycleSeconds, totalSeconds, currentRhythm, adrenalineCount, adrenalineFrequency, lastAdrenalineTime, amiodaroneTotal, adrenalineDue, amiodarone300Due, amiodarone150Due, compressorChanges, pulseChecks, lucasActive, initialRhythm, lidocaineCumulativeDose, lastLidocaineTime, lidocaine1mgDue, lidocaine05mgDue, cyclesWithShocks, adrenalineDismissed, amiodarone300Dismissed, amiodarone150Dismissed, lidocaine1mgDismissed, lidocaine05mgDismissed, shockCount]);

  // Timer effect
  useEffect(() => {
    let interval;
    let thudInterval;
    if (isRunning) {
      interval = setInterval(() => {
        setTotalSeconds(prev => prev + 1);
        setCycleSeconds(prev => {
          const newSeconds = prev + 1;
          if (newSeconds >= CYCLE_DURATION) {
            // Play alert sound
            playBeep(900, 150);
            return CYCLE_DURATION;
          }
          return newSeconds;
        });
      }, 1000);
    }
    return () => {
      clearInterval(interval);
      if (thudInterval) clearInterval(thudInterval);
    };
  }, [isRunning]);

  // Thud sound effect for cycle transitions (110-120s and 0-10s)
  useEffect(() => {
    if (!isRunning) return;
    
    const shouldPlayThud = (cycleSeconds >= 110 && cycleSeconds <= 120) || (cycleSeconds >= 0 && cycleSeconds <= 10);
    
    if (shouldPlayThud) {
      const thudInterval = setInterval(() => {
        playThud();
      }, 1000);
      
      return () => clearInterval(thudInterval);
    }
  }, [isRunning, cycleSeconds, playThud]);

  // Beep sound effect for active alerts
  useEffect(() => {
    const hasActiveAlert = bannerEvents.some(e => e.status === 'active');
    
    if (hasActiveAlert && isRunning) {
      // Clear any existing interval
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
      }
      
      // Play beep immediately
      playBeep(800, 100);
      
      // Set up interval for continuous beeping
      beepIntervalRef.current = setInterval(() => {
        playBeep(800, 100);
      }, 2000);
      
      return () => {
        if (beepIntervalRef.current) {
          clearInterval(beepIntervalRef.current);
          beepIntervalRef.current = null;
        }
      };
    } else {
      // Stop beeping when no active alerts
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    }
  }, [bannerEvents, isRunning, playBeep]);

  const handleStart = () => {
    if (!isRunning && totalSeconds === 0) {
      const now = new Date();
      setStartTime(now.toLocaleString());
      addEvent('start', 'CPR Session Started');
      setHasStarted(true);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setHasStarted(false);
    setSoundEnabled(false);
    setTotalSeconds(0);
    setCycleSeconds(0);
    setCurrentCycle(1);
    setCurrentRhythm(null);
    setInitialRhythm(null);
    setRhythmSelectionStage('unselected');
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
    setMedicationCounts({});
    setUsedProcedures([]);
    setSyncPressCount(0);
    setPulseCheckSynced(false);
    setAdrenalineDismissed(false);
    setAmiodarone300Dismissed(false);
    setAmiodarone150Dismissed(false);
    setLidocaine1mgDismissed(false);
    setLidocaine05mgDismissed(false);
  };



  const handleConfirmCompressorChange = () => {
    playClick();
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
    playClick();
    const newCount = pulseChecks + 1;
    setPulseChecks(newCount);
    addEvent('pulse', `Pulse check performed (Cycle ${currentCycle})`);
    
    // Only move to next cycle if not synced
    if (!pulseCheckSynced) {
      setCurrentCycle(prev => prev + 1);
      setCycleSeconds(0);
      setShockDeliveredThisCycle(false);
      setRhythmSelectionStage('unselected');
      addEvent('cycle', `Cycle ${currentCycle + 1} started`);
    } else {
      // Just reset cycle timer without advancing cycle
      setCycleSeconds(0);
      setShockDeliveredThisCycle(false);
      setRhythmSelectionStage('unselected');
      setPulseCheckSynced(false); // Reset sync flag
    }
  };

  const [syncPressCount, setSyncPressCount] = useState(0);
  const [pulseCheckSynced, setPulseCheckSynced] = useState(false);

  const handleSyncCycle = () => {
    playClick();
    
    const prevTotalSeconds = totalSeconds;
    const prevCycle = currentCycle;
    const newCount = syncPressCount + 1;
    
    setTotalSeconds(prev => prev + 60); // Add 1 minute
    setSyncPressCount(newCount);
    
    if (newCount === 2) {
      // Second press - add cycle
      const prevCycleForUndo = currentCycle;
      setCurrentCycle(prev => prev + 1);
      setCycleSeconds(0);
      setShockDeliveredThisCycle(false);
      setRhythmSelectionStage('unselected');
      addEvent('cycle', `Cycle ${currentCycle + 1} started - Time adjusted`);
      setSyncPressCount(0); // Reset counter
      
      toast.success('Added +1 min & Cycle +1', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setTotalSeconds(prevTotalSeconds);
            setCurrentCycle(prevCycleForUndo);
            setSyncPressCount(0);
            setEvents(prev => prev.slice(0, -1));
          }
        }
      });
    } else {
      // First press - just add time
      toast.success('Added +1 min (press again to add cycle)', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setTotalSeconds(prevTotalSeconds);
            setSyncPressCount(prev => prev - 1);
          }
        }
      });
    }
  };

  const handleSyncPulseCheck = () => {
    playClick();
    
    const prevCycleSeconds = cycleSeconds;
    const prevSynced = pulseCheckSynced;
    
    // Set cycle time to 115 seconds so alarms trigger together (at 110s+ for both)
    setCycleSeconds(115);
    setPulseCheckSynced(true);
    
    toast.success('Pulse check synced - cycle will not advance on confirm', {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setCycleSeconds(prevCycleSeconds);
          setPulseCheckSynced(prevSynced);
        }
      }
    });
  };

  const handleConfirmAdrenaline = () => {
    playClick();
    const newCount = adrenalineCount + 1;
    const eventTime = totalSeconds;
    setAdrenalineCount(newCount);
    setLastAdrenalineTime(eventTime);
    setAdrenalineDue(false);
    setAdrenalineDismissed(false); // Clear dismissed flag when given
    addEvent('adrenaline', `Adrenaline 1mg administered (Dose #${newCount})`, { dose: 1 });
    
    toast.success('Adrenaline 1mg administered', {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setAdrenalineCount(prev => prev - 1);
          setLastAdrenalineTime(null);
          setEvents(prev => prev.slice(0, -1));
        }
      }
    });
  };

  const handleDismissAdrenaline = () => {
    playClick();
    const prevDismissed = adrenalineDismissed;
    setAdrenalineDue(false);
    setAdrenalineDismissed(true);
    
    toast.info('Adrenaline alarm dismissed', {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setAdrenalineDismissed(prevDismissed);
          setAdrenalineDue(true);
        }
      }
    });
  };

  const handleAdrenalineFrequencyChange = (newFrequency) => {
    setAdrenalineFrequency(newFrequency);
  };

  const handleConfirmAmiodarone = (dose) => {
    playClick();
    setAmiodaroneTotal(prev => prev + dose);
    if (dose === 300) {
      setAmiodarone300Due(false);
      setAmiodarone300Dismissed(false); // Clear dismissed flag when given
    } else if (dose === 150) {
      setAmiodarone150Due(false);
      setAmiodarone150Dismissed(false); // Clear dismissed flag when given
    }
    addEvent('amiodarone', `Amiodarone ${dose}mg administered`, { dose });
    
    toast.success(`Amiodarone ${dose}mg administered`, {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setAmiodaroneTotal(prev => prev - dose);
          setEvents(prev => prev.slice(0, -1));
        }
      }
    });
  };

  const handleDismissAmiodarone = (dose) => {
    playClick();
    if (dose === 300) {
      const prevDismissed = amiodarone300Dismissed;
      setAmiodarone300Due(false);
      setAmiodarone300Dismissed(true);
      
      toast.info('Amiodarone 300mg alarm dismissed', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setAmiodarone300Dismissed(prevDismissed);
            setAmiodarone300Due(true);
          }
        }
      });
    } else if (dose === 150) {
      const prevDismissed = amiodarone150Dismissed;
      setAmiodarone150Due(false);
      setAmiodarone150Dismissed(true);
      
      toast.info('Amiodarone 150mg alarm dismissed', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setAmiodarone150Dismissed(prevDismissed);
            setAmiodarone150Due(true);
          }
        }
      });
    }
  };

  const [showLidocaineDialog, setShowLidocaineDialog] = useState(false);
  const [lidocaineDosePerKg, setLidocaineDosePerKg] = useState(1.5);
  const [patientWeight, setPatientWeight] = useState(60);

  const handleConfirmLidocaine = (doseOrEvent) => {
    if (typeof doseOrEvent === 'object') {
      // Called from EventBanner with event object, show dialog
      setShowLidocaineDialog(true);
      return;
    }
    
    // Direct dose value (legacy calls)
    const dose = doseOrEvent;
    playClick();
    setLidocaineCumulativeDose(prev => prev + dose);
    setLastLidocaineTime(totalSeconds);
    if (dose === 1.5) {
      setLidocaine1mgDue(false);
    } else if (dose === 0.75) {
      setLidocaine05mgDue(false);
    }
    addEvent('lidocaine', `Xylocaine ${dose} mg/kg administered (cumulative: ${lidocaineCumulativeDose + dose} mg/kg)`, { dose });
    
    toast.success(`Xylocaine ${dose} mg/kg administered`, {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setLidocaineCumulativeDose(prev => prev - dose);
          setEvents(prev => prev.slice(0, -1));
        }
      }
    });
  };

  const handleLidocaineSubmit = () => {
    const totalDose = lidocaineDosePerKg * patientWeight;
    playClick();
    setLidocaineCumulativeDose(prev => prev + lidocaineDosePerKg);
    setLastLidocaineTime(totalSeconds);
    
    if (lidocaineDosePerKg === 1.5) {
      setLidocaine1mgDue(false);
      setLidocaine1mgDismissed(false); // Clear dismissed flag when given
    } else if (lidocaineDosePerKg === 0.75) {
      setLidocaine05mgDue(false);
      setLidocaine05mgDismissed(false); // Clear dismissed flag when given
    }
    
    addEvent('lidocaine', `Xylocaine ${lidocaineDosePerKg} mg/kg (${totalDose}mg for ${patientWeight}kg) administered (cumulative: ${lidocaineCumulativeDose + lidocaineDosePerKg} mg/kg)`, { dose: lidocaineDosePerKg });
    
    setShowLidocaineDialog(false);
    
    toast.success(`Xylocaine ${lidocaineDosePerKg} mg/kg (${totalDose}mg) administered`, {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setLidocaineCumulativeDose(prev => prev - lidocaineDosePerKg);
          setEvents(prev => prev.slice(0, -1));
        }
      }
    });
  };

  const handleDismissLidocaine = (dose) => {
    playClick();
    if (dose === 1.5) {
      const prevDismissed = lidocaine1mgDismissed;
      setLidocaine1mgDue(false);
      setLidocaine1mgDismissed(true);
      
      toast.info('Xylocaine 1.5 mg/kg alarm dismissed', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setLidocaine1mgDismissed(prevDismissed);
            setLidocaine1mgDue(true);
          }
        }
      });
    } else if (dose === 0.75) {
      const prevDismissed = lidocaine05mgDismissed;
      setLidocaine05mgDue(false);
      setLidocaine05mgDismissed(true);
      
      toast.info('Xylocaine 0.75 mg/kg alarm dismissed', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setLidocaine05mgDismissed(prevDismissed);
            setLidocaine05mgDue(true);
          }
        }
      });
    }
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
    
    // Update medication counter
    const medMapping = {
      'Bicarb': 'Sodium Bicarbonate',
      'Ca': 'Calcium',
      'Glu': 'Glucose',
      'Mg': 'Magnesium',
      'KCl': 'KCl',
      'Atropine': 'Atropine'
    };
    
    const matchedMed = Object.entries(medMapping).find(([short, full]) => 
      medication.includes(full)
    );
    
    if (matchedMed) {
      const [shortName] = matchedMed;
      setMedicationCounts(prev => ({
        ...prev,
        [shortName]: (prev[shortName] || 0) + 1
      }));
    }
    
    // Show toast notification with undo
    toast.success(`${medication} administered`, {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          // Remove the last added med entry
          setDiscretionaryMeds(prev => prev.slice(0, -1));
          // Remove the last event
          setEvents(prev => prev.slice(0, -1));
          // Decrement counter
          if (matchedMed) {
            const [shortName] = matchedMed;
            setMedicationCounts(prev => ({
              ...prev,
              [shortName]: Math.max((prev[shortName] || 1) - 1, 0)
            }));
          }
        }
      }
    });
  };

  const handleAddProcedure = ({ procedure }) => {
    const procEntry = {
      procedure,
      cycle: currentCycle,
      timestamp: new Date().toLocaleTimeString(),
      cprTime: formatCPRTime(totalSeconds)
    };
    setDiscretionaryMeds(prev => [...prev, { medication: procedure, dosage: procedure, ...procEntry }]);
    addEvent('procedure', `${procedure}`, { procedure });
    
    // Mark procedure as used
    const procMapping = {
      'A line': 'A line insertion',
      'Central line': 'Central line insertion',
      'ETT': 'Endotracheal intubation',
      'ECMO': 'ECMO insertion'
    };
    
    const matchedProc = Object.entries(procMapping).find(([short, full]) => 
      procedure.includes(full)
    );
    
    let wasNew = false;
    if (matchedProc) {
      const [shortName] = matchedProc;
      if (!usedProcedures.includes(shortName)) {
        setUsedProcedures(prev => [...prev, shortName]);
        wasNew = true;
      }
    }
    
    // Show toast notification with undo
    toast.success(`${procedure} performed`, {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          // Remove the last added procedure entry
          setDiscretionaryMeds(prev => prev.slice(0, -1));
          // Remove the last event
          setEvents(prev => prev.slice(0, -1));
          // Remove from used procedures if it was newly added
          if (matchedProc && wasNew) {
            const [shortName] = matchedProc;
            setUsedProcedures(prev => prev.filter(p => p !== shortName));
          }
        }
      }
    });
  };

  const handleRhythmChange = (rhythm) => {
    if (rhythmSelectionStage === 'selected') return; // Cannot change if already selected
    
    const prevRhythm = currentRhythm;
    const prevStage = rhythmSelectionStage;
    const prevInitialRhythm = initialRhythm;
    
    setCurrentRhythm(rhythm);
    setRhythmSelectionStage('selected'); // Lock rhythm selection
    
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
    
    toast.success(`Rhythm selected: ${rhythm}`, {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setCurrentRhythm(prevRhythm);
          setRhythmSelectionStage(prevStage);
          if (!prevInitialRhythm) {
            setInitialRhythm(null);
          }
          setEvents(prev => prev.slice(0, -1));
        }
      }
    });
  };

  const handleShockDelivered = (energy) => {
    playClick();
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

    // Single Event Log Table
    const formatEventForPDF = (e) => {
      let description = '';

      switch (e.type) {
        case 'rhythm':
          description = e.message;
          break;
        case 'shock':
          description = `Shock Delivered @ ${e.energy}J (Rhythm: ${e.rhythmBefore})`;
          break;
        case 'compressor':
          description = e.message;
          break;
        case 'pulse':
          description = 'Pulse Check Performed';
          break;
        case 'adrenaline':
          description = `Adrenaline 1mg IV`;
          break;
        case 'amiodarone':
          description = `Amiodarone ${e.dose}mg IV`;
          break;
        case 'lidocaine':
          description = `Xylocaine ${e.dose} mg/kg IV`;
          break;
        case 'discretionary_med':
          description = e.medication || e.dosage || 'Medication Administered';
          break;
        case 'procedure':
          description = e.procedure || 'Procedure Performed';
          break;
        case 'cycle':
          description = e.message;
          break;
        default:
          description = e.message;
      }
      
      return [e.timestamp, description, `Cycle ${e.cycle || '-'}`];
    };

    if (events.length > 0) {
      doc.setFontSize(11);
      doc.text('Event Log', 15, yPos);
      yPos += 5;

      const filteredEvents = events.filter(e => e.type !== 'start' && !e.message?.includes('Time adjusted'));

      doc.autoTable({
        startY: yPos,
        head: [['Time', 'Event', 'Cycle']],
        body: filteredEvents.map(formatEventForPDF),
        theme: 'striped',
        styles: { fontSize: 8 },
        margin: { left: 15 },
        headStyles: { fillColor: [30, 64, 175] }
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // Notes section - wrap text properly within A4 margins
    if (doctorNotes) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(11);
      doc.text('Note1 (During CPR)', 15, yPos);
      yPos += 6;
      doc.setFontSize(9);
      const splitNotes = doc.splitTextToSize(doctorNotes, 170);
      doc.text(splitNotes, 15, yPos);
      yPos += splitNotes.length * 5 + 6;
    }

    if (notes) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(11);
      doc.text('Note2 (End Session)', 15, yPos);
      yPos += 6;
      doc.setFontSize(9);
      const splitNote2 = doc.splitTextToSize(notes, 170);
      doc.text(splitNote2, 15, yPos);
    }

    // Footer on last page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated: ${new Date().toLocaleString()} | CPR Tracker - ACLS Compliant | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    // Download PDF
    const fileName = `CPR_Session_${new Date().toISOString().slice(0, 10)}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <Toaster position="bottom-center" richColors />

      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Code Blue Timer
            </h1>
            <p className="text-slate-400 mt-1">Realtime ACLS Coach & Tracker</p>
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
          soundEnabled={soundEnabled}
          onSoundToggle={setSoundEnabled}
          hasStarted={hasStarted}
          onSyncCycle={handleSyncCycle}
        />

        {/* Rhythm Selector */}
        <RhythmSelector 
          currentRhythm={currentRhythm} 
          rhythmSelectionStage={rhythmSelectionStage}
          onRhythmChange={handleRhythmChange}
          onShockDelivered={handleShockDelivered}
          shockCount={shockCount}
          shockDeliveredThisCycle={shockDeliveredThisCycle}
          isRunning={isRunning}
          disabled={!hasStarted}
        />

        {/* Event Banners */}
        <EventBanner 
          events={bannerEvents}
          onConfirmCompressorChange={handleConfirmCompressorChange}
          onConfirmPulseCheck={handleConfirmPulseCheck}
          onConfirmAdrenaline={handleConfirmAdrenaline}
          onDismissAdrenaline={handleDismissAdrenaline}
          onConfirmAmiodarone={handleConfirmAmiodarone}
          onDismissAmiodarone={handleDismissAmiodarone}
          onConfirmLidocaine={handleConfirmLidocaine}
          onDismissLidocaine={handleDismissLidocaine}
          onAdrenalineFrequencyChange={handleAdrenalineFrequencyChange}
          onSyncPulseCheck={handleSyncPulseCheck}
          pulseCheckSynced={pulseCheckSynced}
          lucasActive={lucasActive}
          onToggleLucas={handleToggleLucas}
          disabled={!hasStarted}
        />

        {/* Common Medications */}
        <CommonMedications 
          onAddMedication={handleAddDiscretionaryMed} 
          medicationCounts={medicationCounts}
          disabled={!hasStarted}
        />

        {/* Common Procedures */}
        <CommonProcedures 
          onAddProcedure={handleAddProcedure} 
          usedProcedures={usedProcedures}
          disabled={!hasStarted}
        />

        {/* Event Log */}
        <EventLog events={events} />

            {/* Notes Section */}
            <div className="grid grid-cols-1 gap-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <label className="text-slate-300 font-semibold mb-2 block">
              📝 Notes
            </label>
            <textarea
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value.slice(0, 400))}
              placeholder="text or talk"
              maxLength={400}
              rows={6}
              disabled={!hasStarted}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="text-xs text-slate-500 mt-1 text-right">
              {doctorNotes.length}/400 characters
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

      {/* Lidocaine Dialog */}
      <Dialog open={showLidocaineDialog} onOpenChange={setShowLidocaineDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Administer Xylocaine (Lidocaine)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">Dose per kg</label>
              <Select value={lidocaineDosePerKg.toString()} onValueChange={(val) => setLidocaineDosePerKg(parseFloat(val))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="0.5" className="text-white">0.5 mg/kg</SelectItem>
                  <SelectItem value="0.75" className="text-white">0.75 mg/kg</SelectItem>
                  <SelectItem value="1.0" className="text-white">1.0 mg/kg</SelectItem>
                  <SelectItem value="1.5" className="text-white">1.5 mg/kg</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">Patient Weight (kg)</label>
              <input
                type="number"
                value={patientWeight}
                onChange={(e) => setPatientWeight(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
                min="1"
                max="200"
              />
            </div>

            <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4">
              <div className="text-blue-300 text-sm mb-1">Total Dose</div>
              <div className="text-white text-3xl font-bold">
                {(lidocaineDosePerKg * patientWeight).toFixed(1)} mg
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowLidocaineDialog(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleLidocaineSubmit}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
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