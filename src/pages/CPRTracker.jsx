import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Play, Square, AlertTriangle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

// Import audio files
import adrenalineAudio from '@/adrenaline.mp3';
import amiodarone300Audio from '@/amiodarone300.mp3';
import amiodarone150Audio from '@/amiodarone150.mp3';
import xylocaineAudio from '@/xylocaine.mp3';
import pulsecheckAudio from '@/pulsecheck.mp3';

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
  
  // Header visibility state
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerHideTimerRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const touchStartYRef = useRef(0);
  
  // Carousel state for page indicators
  const [currentPage, setCurrentPage] = useState(0);
  const carouselApiRef = useRef(null);
  
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
  const [amiodaroneFirstDoseShockCount, setAmiodaroneFirstDoseShockCount] = useState(null);
  const [compressorChanges, setCompressorChanges] = useState(0);
  const [pulseChecks, setPulseChecks] = useState(0);
  
  // Adrenaline frequency and tracking
  const [adrenalineFrequency, setAdrenalineFrequency] = useState(4); // 3, 4, or 5 minutes
  const [lastAdrenalineTime, setLastAdrenalineTime] = useState(null);
  const [shockCountAtRhythmChange, setShockCountAtRhythmChange] = useState(null); // Track shock count when changing to shockable rhythm
  
  // Track which medications are due
  const [adrenalineDue, setAdrenalineDue] = useState(false);
  const [amiodarone300Due, setAmiodarone300Due] = useState(false);
  const [amiodarone150Due, setAmiodarone150Due] = useState(false);
  
  // Track dismissed alarms
  const [adrenalineDismissed, setAdrenalineDismissed] = useState(false);
  const [adrenalineDismissedTime, setAdrenalineDismissedTime] = useState(null);
  const [amiodarone300Dismissed, setAmiodarone300Dismissed] = useState(false);
  const [amiodarone150Dismissed, setAmiodarone150Dismissed] = useState(false);
  const [amiodaroneDismissedShockCount, setAmiodaroneDismissedShockCount] = useState(null);
  const [lidocaine1mgDismissed, setLidocaine1mgDismissed] = useState(false);
  const [lidocaine05mgDismissed, setLidocaine05mgDismissed] = useState(false);
  const [lidocaineDismissedTime, setLidocaineDismissedTime] = useState(null);

  // Track snoozed alarms (stores the time when snooze ends)
  const [adrenalineSnoozedUntil, setAdrenalineSnoozedUntil] = useState(null);
  const [amiodarone300SnoozedUntil, setAmiodarone300SnoozedUntil] = useState(null);
  const [amiodarone150SnoozedUntil, setAmiodarone150SnoozedUntil] = useState(null);
  const [lidocaine1mgSnoozedUntil, setLidocaine1mgSnoozedUntil] = useState(null);
  const [lidocaine05mgSnoozedUntil, setLidocaine05mgSnoozedUntil] = useState(null);
  
  // Lidocaine tracking
  const [lidocaineCumulativeDose, setLidocaineCumulativeDose] = useState(0); // in mg/kg
  const [lastLidocaineTime, setLastLidocaineTime] = useState(null);
  const [lidocaine1mgDue, setLidocaine1mgDue] = useState(false);
  const [lidocaine05mgDue, setLidocaine05mgDue] = useState(false);
  const [amiodarone450ReachedTime, setAmiodarone450ReachedTime] = useState(null); // Track when amiodarone reaches 450mg
  
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
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Audio context and refs
  const audioContextRef = useRef(null);
  const beepIntervalRef = useRef(null);
  
  // Audio refs for medication alerts
  const adrenalineAudioRef = useRef(null);
  const amiodarone300AudioRef = useRef(null);
  const amiodarone150AudioRef = useRef(null);
  const xylocaineAudioRef = useRef(null);
  const pulsecheckAudioRef = useRef(null);
  
  // Audio queue system with priority
  // Priority order: pulsecheck (1, highest) > adrenaline (2) > amiodarone (3) > xylocaine (4, lowest)
  const AUDIO_PRIORITIES = {
    pulsecheck: 1,
    adrenaline: 2,
    amiodarone300: 3,
    amiodarone150: 3,
    xylocaine: 4
  };
  
  const audioQueueRef = useRef([]);
  const isPlayingAudioRef = useRef(false);
  const lastAudioPlayTimeRef = useRef(0);
  // Track which alerts have played audio (all alerts play once per activation)
  const playedAudioRef = useRef({
    adrenaline: false,
    amiodarone300: false,
    amiodarone150: false,
    xylocaine: false,
    pulsecheck: false
  });
  // Track previous dismissed states to detect when alerts are reactivated
  const prevDismissedRef = useRef({
    adrenaline: false,
    amiodarone300: false,
    amiodarone150: false,
    xylocaine: false
  });

  // Initialize Web Audio API and load audio files
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    // Load audio files using imported URLs
    adrenalineAudioRef.current = new Audio(adrenalineAudio);
    amiodarone300AudioRef.current = new Audio(amiodarone300Audio);
    amiodarone150AudioRef.current = new Audio(amiodarone150Audio);
    xylocaineAudioRef.current = new Audio(xylocaineAudio);
    pulsecheckAudioRef.current = new Audio(pulsecheckAudio);
    
    // Preload audio files
    const audioRefs = [adrenalineAudioRef, amiodarone300AudioRef, amiodarone150AudioRef, xylocaineAudioRef, pulsecheckAudioRef];
    audioRefs.forEach(audioRef => {
      if (audioRef.current) {
        audioRef.current.preload = 'auto';
        audioRef.current.volume = 1.0;
      }
    });
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Function to play audio from queue with 2 second delay
  const playAudioFromQueue = useCallback(() => {
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLastAudio = now - lastAudioPlayTimeRef.current;
    const delayBetweenAudio = 2000; // 2 seconds

    if (timeSinceLastAudio < delayBetweenAudio && lastAudioPlayTimeRef.current > 0) {
      // Wait until 2 seconds have passed since last audio (skip check on first audio)
      const waitTime = delayBetweenAudio - timeSinceLastAudio;
      setTimeout(() => {
        playAudioFromQueue();
      }, waitTime);
      return;
    }

    // Play the next audio in queue
    const audioFile = audioQueueRef.current.shift();
    const audioRef = audioFile === 'adrenaline' ? adrenalineAudioRef.current :
                     audioFile === 'amiodarone300' ? amiodarone300AudioRef.current :
                     audioFile === 'amiodarone150' ? amiodarone150AudioRef.current :
                     audioFile === 'xylocaine' ? xylocaineAudioRef.current :
                     audioFile === 'pulsecheck' ? pulsecheckAudioRef.current : null;

    if (audioRef) {
      isPlayingAudioRef.current = true;
      lastAudioPlayTimeRef.current = Date.now();
      
      // Reset audio to start
      audioRef.currentTime = 0;
      
      // Handle audio end
      const handleEnded = () => {
        isPlayingAudioRef.current = false;
        audioRef.removeEventListener('ended', handleEnded);
        // Play next audio in queue if any
        if (audioQueueRef.current.length > 0) {
          playAudioFromQueue();
        }
      };
      
      audioRef.addEventListener('ended', handleEnded);
      
      audioRef.play().catch((error) => {
        console.error('Error playing audio:', error);
        isPlayingAudioRef.current = false;
        audioRef.removeEventListener('ended', handleEnded);
        // Continue with next audio in queue
        if (audioQueueRef.current.length > 0) {
          playAudioFromQueue();
        }
      });
    } else {
      isPlayingAudioRef.current = false;
      // Continue with next audio in queue
      if (audioQueueRef.current.length > 0) {
        playAudioFromQueue();
      }
    }
  }, []);

  // Function to queue audio playback with priority ordering
  const queueAudio = useCallback((audioFile) => {
    if (!soundEnabled || !isRunning) return;
    
    const priority = AUDIO_PRIORITIES[audioFile] || 99;
    
    // Insert audio file into queue based on priority (lower number = higher priority)
    // If priority is same, maintain FIFO order
    const insertIndex = audioQueueRef.current.findIndex(
      item => AUDIO_PRIORITIES[item] > priority
    );
    
    if (insertIndex === -1) {
      // No item with lower priority, add to end
      audioQueueRef.current.push(audioFile);
    } else {
      // Insert before first item with lower priority
      audioQueueRef.current.splice(insertIndex, 0, audioFile);
    }
    
    playAudioFromQueue();
  }, [soundEnabled, isRunning, playAudioFromQueue]);

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
    // - Crossover VF/pVT → PEA/Asystole: maintain time interval
    // - Crossover PEA/Asystole → VF/pVT: next dose after 2nd shock in new rhythm, then maintain interval

    const shouldShowAdrenaline = (() => {
      if (adrenalineCount === 0) {
        // First dose ever
        return isPEAorAsystole ? totalSeconds >= 10 : isShockable ? shockCount >= 2 : false;
      }

      // Check if we need to wait for shocks after rhythm crossover to shockable
      if (isShockable && shockCountAtRhythmChange !== null) {
        const shocksInCurrentShockableRhythm = shockCount - shockCountAtRhythmChange;
        if (shocksInCurrentShockableRhythm < 2) {
          // Still waiting for 2nd shock after crossover
          return false;
        }
      }

      // Normal time interval check
      return timeSinceLastAdrenaline !== null && timeSinceLastAdrenaline >= adrenalineIntervalSeconds;
    })();

    // Check amiodarone timing - only for shockable rhythms
    const shouldShowAmiodarone300 = isShockable && shockCount >= 3 && amiodaroneTotal < 300;
    // Second dose: 2 shocks after first dose was given (if delayed), otherwise default to shock 5
    const amiodarone150ShockThreshold = amiodaroneFirstDoseShockCount !== null 
      ? amiodaroneFirstDoseShockCount + 2 
      : 5;
    const shouldShowAmiodarone150 = isShockable && shockCount >= amiodarone150ShockThreshold && amiodaroneTotal >= 300 && amiodaroneTotal < 450;

    // Lidocaine (Xylocaine) rules - Coach mode: 6 minutes after amiodarone 450mg, then every 6 minutes
    // Track mode: based on dose number and max cumulative dose of 3 mg/kg
    const lidocaineGivenCount = events.filter(e => e.type === 'lidocaine').length;
    
    let shouldShowLidocaine1mg = false;
    let shouldShowLidocaine05mg = false;
    
    if (soundEnabled) {
      // Coach mode: Time-based after amiodarone 450mg
      if (isShockable && amiodarone450ReachedTime !== null && lidocaineCumulativeDose < 3) {
        const timeSinceAmio450 = totalSeconds - amiodarone450ReachedTime;
        const timeSinceLastLidocaine = lastLidocaineTime !== null ? totalSeconds - lastLidocaineTime : null;
        
        if (lidocaineGivenCount === 0) {
          // First dose: 6 minutes after amiodarone 450mg
          shouldShowLidocaine1mg = timeSinceAmio450 >= 360; // 6 minutes = 360 seconds
        } else {
          // Subsequent doses: every 6 minutes
          shouldShowLidocaine05mg = timeSinceLastLidocaine !== null && timeSinceLastLidocaine >= 360;
        }
      }
    } else {
      // Track mode: Shock-based
      shouldShowLidocaine1mg = isShockable && shockCount >= 8 && lidocaineGivenCount === 0 && lidocaineCumulativeDose < 3;
      const shouldShowLidocaine2nd = isShockable && shockCount >= 11 && lidocaineGivenCount === 1 && lidocaineCumulativeDose < 3;
      const shouldShowLidocaine3rd = isShockable && shockCount >= 14 && lidocaineGivenCount === 2 && lidocaineCumulativeDose < 3;
      const shouldShowLidocaine4th = isShockable && shockCount >= 17 && lidocaineGivenCount === 3 && lidocaineCumulativeDose < 3;
      const shouldShowLidocaine5th = isShockable && shockCount >= 20 && lidocaineGivenCount === 4 && lidocaineCumulativeDose < 3;
      const shouldShowLidocaineNth = isShockable && shockCount >= 23 && lidocaineGivenCount >= 5 && lidocaineCumulativeDose < 3 && (shockCount - 20) % 3 === 0;
      shouldShowLidocaine05mg = shouldShowLidocaine2nd || shouldShowLidocaine3rd || shouldShowLidocaine4th || shouldShowLidocaine5th || shouldShowLidocaineNth;
    }

    // Set due flags for tracking
    if (shouldShowAdrenaline && !adrenalineDue && !adrenalineDismissed) {
      setAdrenalineDue(true);
    }
    if (shouldShowAmiodarone300 && !amiodarone300Due && !amiodarone300Dismissed) {
      setAmiodarone300Due(true);
    }
    if (shouldShowAmiodarone150 && !amiodarone150Due && !amiodarone150Dismissed) {
      setAmiodarone150Due(true);
    }
    if (shouldShowLidocaine1mg && !lidocaine1mgDue && !lidocaine1mgDismissed) {
      setLidocaine1mgDue(true);
    }
    if (shouldShowLidocaine05mg && !lidocaine05mgDue && !lidocaine05mgDismissed) {
      setLidocaine05mgDue(true);
    }

    // Check if dismissed adrenaline should be alerted again (coach mode only)
    if (soundEnabled && adrenalineDismissed && adrenalineDismissedTime !== null) {
      const timeSinceDismissed = totalSeconds - adrenalineDismissedTime;
      if (timeSinceDismissed >= adrenalineIntervalSeconds) {
        setAdrenalineDismissed(false);
        setAdrenalineDismissedTime(null);
      }
    }

    // Check if dismissed amiodarone should be alerted again (coach mode only)
    if (soundEnabled && amiodaroneDismissedShockCount !== null) {
      const shocksSinceDismissed = shockCount - amiodaroneDismissedShockCount;
      if (shocksSinceDismissed >= 2) {
        setAmiodarone300Dismissed(false);
        setAmiodarone150Dismissed(false);
        setAmiodaroneDismissedShockCount(null);
      }
    }

    // Check if dismissed xylocaine should be alerted again (coach mode only)
    if (soundEnabled && lidocaineDismissedTime !== null) {
      const timeSinceDismissed = totalSeconds - lidocaineDismissedTime;
      if (timeSinceDismissed >= 360) { // 6 minutes = 360 seconds
        setLidocaine1mgDismissed(false);
        setLidocaine05mgDismissed(false);
        setLidocaineDismissedTime(null);
      }
    }

    // Determine adrenaline status - only 'active' or 'pending' (no 'completed' state like amiodarone/xylocaine)
    let adrenalineStatus = 'pending';
    const isAdrenalineSnoozed = adrenalineSnoozedUntil !== null && totalSeconds < adrenalineSnoozedUntil;
    if (shouldShowAdrenaline && !adrenalineDismissed && !isAdrenalineSnoozed) {
      adrenalineStatus = soundEnabled ? 'active' : 'pending';
    }

    // For shockable rhythms, always show ACLS drugs (both track and coach mode)
    // For coach mode, specific doses trigger as active alerts based on protocol
    // For track mode, all drugs are available without protocol restrictions
    const inTrackMode = !soundEnabled;
    const inCoachMode = soundEnabled;

    const newBannerEvents = [
      {
        type: 'pulse',
        label: 'Pulse Check',
        timing: '< 10 seconds',
        status: cycleComplete && pulseChecks < cycle ? 'active' : (pulseChecks >= cycle ? 'completed' : 'pending')
      },
      {
        type: 'compressor',
        label: lucasActive ? 'LUCAS activated' : 'New Rescuer',
        timing: 'Every cycle',
        status: lucasActive ? 'pending' : (cycleComplete && compressorChanges < cycle ? 'active' : (compressorChanges >= cycle ? 'completed' : 'pending'))
      },
      {
        type: 'adrenaline',
        label: 'Adrenaline 1mg',
        timing: `Every ${adrenalineFrequency} minutes`,
        status: inTrackMode && isShockable ? 'pending' : adrenalineStatus,
        frequency: adrenalineFrequency
      },
      // Amiodarone - show for all shockable rhythms (hide if max dose reached)
      ...(isShockable && amiodaroneTotal < 450 ? [{
        type: 'amiodarone',
        label: 'Amiodarone',
        timing: inTrackMode ? 'PRN' : 'After 3rd/5th shock',
        dose: null, // Always use dialog for dose selection
        status: (() => {
          if (inTrackMode) return 'pending';
          // Check if snoozed
          const is300Snoozed = amiodarone300SnoozedUntil !== null && totalSeconds < amiodarone300SnoozedUntil;
          const is150Snoozed = amiodarone150SnoozedUntil !== null && totalSeconds < amiodarone150SnoozedUntil;
          // Coach mode: check if any amiodarone dose is due
          if ((shouldShowAmiodarone300 && !amiodarone300Dismissed && !is300Snoozed) || (shouldShowAmiodarone150 && !amiodarone150Dismissed && !is150Snoozed)) {
            return 'active';
          }
          return 'pending';
        })()
      }] : []),
      // Xylocaine - show for all shockable rhythms (hide if max dose reached)
      ...(isShockable && lidocaineCumulativeDose < 3 ? [{
        type: 'lidocaine',
        label: 'Xylocaine',
        timing: inTrackMode ? 'PRN' : 'Every 5-10 minutes',
        dose: null, // Always use dialog for dose selection
        status: (() => {
          if (inTrackMode) return 'pending';
          // Check if snoozed
          const is1mgSnoozed = lidocaine1mgSnoozedUntil !== null && totalSeconds < lidocaine1mgSnoozedUntil;
          const is05mgSnoozed = lidocaine05mgSnoozedUntil !== null && totalSeconds < lidocaine05mgSnoozedUntil;
          // Coach mode: check if any lidocaine dose is due
          if ((shouldShowLidocaine1mg && !lidocaine1mgDismissed && !is1mgSnoozed) || (shouldShowLidocaine05mg && !lidocaine05mgDismissed && !is05mgSnoozed)) {
            return 'active';
          }
          return 'pending';
        })()
      }] : [])
    ];

    setBannerEvents(newBannerEvents);
    }, [currentCycle, cycleSeconds, totalSeconds, currentRhythm, adrenalineCount, adrenalineFrequency, lastAdrenalineTime, amiodaroneTotal, adrenalineDue, amiodarone300Due, amiodarone150Due, compressorChanges, pulseChecks, lucasActive, initialRhythm, lidocaineCumulativeDose, lastLidocaineTime, lidocaine1mgDue, lidocaine05mgDue, cyclesWithShocks, adrenalineDismissed, amiodarone300Dismissed, amiodarone150Dismissed, lidocaine1mgDismissed, lidocaine05mgDismissed, shockCount, adrenalineSnoozedUntil, amiodarone300SnoozedUntil, amiodarone150SnoozedUntil, lidocaine1mgSnoozedUntil, lidocaine05mgSnoozedUntil, soundEnabled, amiodarone450ReachedTime, events]);

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

  // Auto-hide header after 3 seconds (always, even during CPR session)
  useEffect(() => {
    // Clear existing timer
    if (headerHideTimerRef.current) {
      clearTimeout(headerHideTimerRef.current);
    }

    // Show header initially and set timer to hide it
    setHeaderVisible(true);
    headerHideTimerRef.current = setTimeout(() => {
      setHeaderVisible(false);
    }, 3000); // Hide after 3 seconds

    return () => {
      if (headerHideTimerRef.current) {
        clearTimeout(headerHideTimerRef.current);
      }
    };
  }, [hasStarted, isRunning]); // Reset timer when session starts/pauses

  // Handle pull-to-refresh to show header
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartYRef.current = e.touches[0].clientY;
      lastScrollYRef.current = window.scrollY;
    };

    const handleTouchMove = (e) => {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartYRef.current;
      const scrollY = window.scrollY;

      // Detect pull-down gesture (scrolling up from top)
      if (scrollY <= 0 && deltaY > 50) {
        setHeaderVisible(true);
        // Reset timer when header is shown via pull
        if (headerHideTimerRef.current) {
          clearTimeout(headerHideTimerRef.current);
        }
        headerHideTimerRef.current = setTimeout(() => {
          setHeaderVisible(false);
        }, 3000);
      }
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show header when scrolling to top
      if (currentScrollY <= 0 && lastScrollYRef.current > 0) {
        setHeaderVisible(true);
        if (headerHideTimerRef.current) {
          clearTimeout(headerHideTimerRef.current);
        }
        headerHideTimerRef.current = setTimeout(() => {
          setHeaderVisible(false);
        }, 3000);
      }
      
      lastScrollYRef.current = currentScrollY;
    };

    // Add event listeners
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Play medication alert audio files when alerts become active
  useEffect(() => {
    if (!soundEnabled || !isRunning) return;

    // Check for adrenaline alert - play ONCE per activation
    if (adrenalineDue && !adrenalineDismissed && !playedAudioRef.current.adrenaline) {
      const isAdrenalineSnoozed = adrenalineSnoozedUntil !== null && totalSeconds < adrenalineSnoozedUntil;
      if (!isAdrenalineSnoozed) {
        playedAudioRef.current.adrenaline = true;
        queueAudio('adrenaline');
      }
    }

    // Check for amiodarone 300mg alert - play ONCE per activation
    if (amiodarone300Due && !amiodarone300Dismissed && !playedAudioRef.current.amiodarone300) {
      const is300Snoozed = amiodarone300SnoozedUntil !== null && totalSeconds < amiodarone300SnoozedUntil;
      if (!is300Snoozed) {
        playedAudioRef.current.amiodarone300 = true;
        queueAudio('amiodarone300');
      }
    }

    // Check for amiodarone 150mg alert - play ONCE per activation
    if (amiodarone150Due && !amiodarone150Dismissed && !playedAudioRef.current.amiodarone150) {
      const is150Snoozed = amiodarone150SnoozedUntil !== null && totalSeconds < amiodarone150SnoozedUntil;
      if (!is150Snoozed) {
        playedAudioRef.current.amiodarone150 = true;
        queueAudio('amiodarone150');
      }
    }

    // Check for xylocaine/lidocaine alert - play ONCE per activation
    if ((lidocaine1mgDue || lidocaine05mgDue) && !lidocaine1mgDismissed && !lidocaine05mgDismissed && !playedAudioRef.current.xylocaine) {
      const is1mgSnoozed = lidocaine1mgSnoozedUntil !== null && totalSeconds < lidocaine1mgSnoozedUntil;
      const is05mgSnoozed = lidocaine05mgSnoozedUntil !== null && totalSeconds < lidocaine05mgSnoozedUntil;
      if (!is1mgSnoozed && !is05mgSnoozed) {
        playedAudioRef.current.xylocaine = true;
        queueAudio('xylocaine');
      }
    }

    // Clear snooze state when snooze expires and prevent audio from replaying
    // Don't reset audio flags here - only reset when alert becomes inactive
    if (adrenalineSnoozedUntil !== null && totalSeconds >= adrenalineSnoozedUntil) {
      setAdrenalineSnoozedUntil(null);
    }
    if (amiodarone300SnoozedUntil !== null && totalSeconds >= amiodarone300SnoozedUntil) {
      setAmiodarone300SnoozedUntil(null);
    }
    if (amiodarone150SnoozedUntil !== null && totalSeconds >= amiodarone150SnoozedUntil) {
      setAmiodarone150SnoozedUntil(null);
    }
    if (lidocaine1mgSnoozedUntil !== null && totalSeconds >= lidocaine1mgSnoozedUntil) {
      setLidocaine1mgSnoozedUntil(null);
    }
    if (lidocaine05mgSnoozedUntil !== null && totalSeconds >= lidocaine05mgSnoozedUntil) {
      setLidocaine05mgSnoozedUntil(null);
    }

    // Reset audio flags when alerts become inactive (not due anymore)
    // This prevents audio from replaying when snooze expires if alert is still active
    if (prevDismissedRef.current.adrenaline && !adrenalineDismissed) {
      // Alert reactivated after dismissal
      if (!adrenalineDue) {
        playedAudioRef.current.adrenaline = false;
      }
    } else if (!adrenalineDue && prevDismissedRef.current.adrenalineDue) {
      // Alert became inactive
      playedAudioRef.current.adrenaline = false;
    }
    
    if (prevDismissedRef.current.amiodarone300 && !amiodarone300Dismissed) {
      if (!amiodarone300Due) {
        playedAudioRef.current.amiodarone300 = false;
      }
    } else if (!amiodarone300Due && prevDismissedRef.current.amiodarone300Due) {
      playedAudioRef.current.amiodarone300 = false;
    }
    
    if (prevDismissedRef.current.amiodarone150 && !amiodarone150Dismissed) {
      if (!amiodarone150Due) {
        playedAudioRef.current.amiodarone150 = false;
      }
    } else if (!amiodarone150Due && prevDismissedRef.current.amiodarone150Due) {
      playedAudioRef.current.amiodarone150 = false;
    }
    
    const xylocaineWasDismissed = prevDismissedRef.current.xylocaine;
    const xylocaineIsDismissed = lidocaine1mgDismissed && lidocaine05mgDismissed;
    const xylocaineIsDue = lidocaine1mgDue || lidocaine05mgDue;
    if (xylocaineWasDismissed && !xylocaineIsDismissed) {
      if (!xylocaineIsDue) {
        playedAudioRef.current.xylocaine = false;
      }
    } else if (!xylocaineIsDue && prevDismissedRef.current.xylocaineDue) {
      playedAudioRef.current.xylocaine = false;
    }

    // Update previous states
    prevDismissedRef.current.adrenaline = adrenalineDismissed;
    prevDismissedRef.current.amiodarone300 = amiodarone300Dismissed;
    prevDismissedRef.current.amiodarone150 = amiodarone150Dismissed;
    prevDismissedRef.current.xylocaine = xylocaineIsDismissed;
    prevDismissedRef.current.adrenalineDue = adrenalineDue;
    prevDismissedRef.current.amiodarone300Due = amiodarone300Due;
    prevDismissedRef.current.amiodarone150Due = amiodarone150Due;
    prevDismissedRef.current.xylocaineDue = xylocaineIsDue;
  }, [adrenalineDue, amiodarone300Due, amiodarone150Due, lidocaine1mgDue, lidocaine05mgDue, 
      adrenalineDismissed, amiodarone300Dismissed, amiodarone150Dismissed, 
      lidocaine1mgDismissed, lidocaine05mgDismissed,
      adrenalineSnoozedUntil, amiodarone300SnoozedUntil, amiodarone150SnoozedUntil,
      lidocaine1mgSnoozedUntil, lidocaine05mgSnoozedUntil,
      soundEnabled, isRunning, totalSeconds, queueAudio]);

  // Play pulse check alert audio when pulse check alert becomes active
  useEffect(() => {
    if (!soundEnabled || !isRunning) return;

    // Pulse check alert is active when cycleComplete && pulseChecks < cycle
    const cycleComplete = cycleSeconds >= CYCLE_DURATION - 5;
    const pulseCheckActive = cycleComplete && pulseChecks < currentCycle;

    // Play pulse check audio ONCE per activation
    if (pulseCheckActive && !playedAudioRef.current.pulsecheck) {
      playedAudioRef.current.pulsecheck = true;
      queueAudio('pulsecheck');
    }

    // Reset pulse check audio flag when alert becomes inactive (cycle advances or pulse check is performed)
    if (!pulseCheckActive && playedAudioRef.current.pulsecheck) {
      playedAudioRef.current.pulsecheck = false;
    }
  }, [cycleSeconds, currentCycle, pulseChecks, soundEnabled, isRunning, queueAudio]);

  // Beep sound effect for active alerts, rhythm selection, and shock button
  useEffect(() => {
    const hasMedicationAlert = bannerEvents.some(e => e.status === 'active' && ['adrenaline', 'amiodarone', 'lidocaine'].includes(e.type));
    const hasOtherAlert = bannerEvents.some(e => e.status === 'active' && ['pulse', 'compressor'].includes(e.type));
    const needsRhythmSelection = rhythmSelectionStage === 'unselected' && isRunning;
    const isShockable = currentRhythm === 'VF' || currentRhythm === 'pVT';
    const shockButtonActive = isShockable && !(soundEnabled && shockDeliveredThisCycle);

    const shouldBeepMedication = hasMedicationAlert;
    const shouldBeepOther = hasOtherAlert || needsRhythmSelection || shockButtonActive;

    if ((shouldBeepMedication || shouldBeepOther) && isRunning && soundEnabled) {
      // Clear any existing interval
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
      }

      // Set up interval for continuous beeping
      // Medication alarms: 1200Hz at 100ms, Other alarms: 600Hz at 50ms
      const frequency = shouldBeepMedication ? 1200 : 600;
      const duration = shouldBeepMedication ? 100 : 50;

      beepIntervalRef.current = setInterval(() => {
        playBeep(frequency, duration);
      }, 600);

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
  }, [bannerEvents, isRunning, playBeep, rhythmSelectionStage, currentRhythm, soundEnabled, shockDeliveredThisCycle]);

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
    setAmiodaroneFirstDoseShockCount(null);
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
    setAmiodarone450ReachedTime(null);
    setDiscretionaryMeds([]);
    setShockDeliveredThisCycle(false);
    setMedicationCounts({});
    setUsedProcedures([]);
    setSyncPressCount(0);
    setPulseCheckSynced(false);
    setAdrenalineDismissed(false);
    setAdrenalineDismissedTime(null);
    setAmiodarone300Dismissed(false);
    setAmiodarone150Dismissed(false);
    setAmiodaroneDismissedShockCount(null);
    setLidocaine1mgDismissed(false);
    setLidocaine05mgDismissed(false);
    setLidocaineDismissedTime(null);
    setShockCountAtRhythmChange(null);
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
    setAdrenalineSnoozedUntil(null); // Clear snooze when given
    // Reset audio tracking so it can play again for next activation
    playedAudioRef.current.adrenaline = false;

    // Clear crossover tracking once adrenaline is given in new shockable rhythm
    if (shockCountAtRhythmChange !== null) {
      setShockCountAtRhythmChange(null);
    }

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

  const handleSnoozeAdrenaline = () => {
    playClick();
    const prevSnoozedUntil = adrenalineSnoozedUntil;
    const snoozeUntil = totalSeconds + 90; // 90 seconds from now
    setAdrenalineSnoozedUntil(snoozeUntil);
    // Keep audio flag true to prevent replay while snoozed

    toast.info('Adrenaline alarm snoozed for 90 seconds', {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setAdrenalineSnoozedUntil(prevSnoozedUntil);
        }
      }
    });
  };

  const handleDismissAdrenaline = () => {
    playClick();
    const prevDismissed = adrenalineDismissed;
    const prevDismissedTime = adrenalineDismissedTime;
    setAdrenalineDue(false);
    setAdrenalineDismissed(true);
    setAdrenalineDismissedTime(totalSeconds);
    
    toast.info('Adrenaline alarm dismissed', {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setAdrenalineDismissed(prevDismissed);
          setAdrenalineDismissedTime(prevDismissedTime);
          setAdrenalineDue(true);
        }
      }
    });
  };

  const handleAdrenalineFrequencyChange = (newFrequency) => {
    setAdrenalineFrequency(newFrequency);
  };

  const handleConfirmAmiodarone = (doseOrEvent) => {
    // If called with an event object, show dialog
    if (typeof doseOrEvent === 'object' && doseOrEvent.dose === null) {
      // Determine which dose number based on amiodarone total
      const doseNum = amiodaroneTotal < 300 ? 1 : 2;
      setAmiodaroneDoseNumber(doseNum);
      setAmiodaroneDose(doseNum === 1 ? 300 : 150); // Set default based on dose number
      setShowAmiodaroneDialog(true);
      return;
    }
    
    // Otherwise, it's a direct dose value
    const dose = doseOrEvent;
    playClick();
    setAmiodaroneTotal(prev => prev + dose);
    if (dose === 300) {
      setAmiodarone300Due(false);
      setAmiodarone300Dismissed(false);
    } else if (dose === 150) {
      setAmiodarone150Due(false);
      setAmiodarone150Dismissed(false);
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
  
  const handleAmiodaroneSubmit = () => {
    // Check max dose limit (450 mg)
    if (amiodaroneTotal + amiodaroneDose > 450) {
      toast.error('Cannot administer: Max dose 450 mg is reached', {
        duration: 4000,
        position: 'bottom-center'
      });
      return;
    }

    playClick();
    const newTotal = amiodaroneTotal + amiodaroneDose;
    const prevFirstDoseShockCount = amiodaroneFirstDoseShockCount;
    setAmiodaroneTotal(newTotal);

    // Track shock count when first dose (300mg) is given for second dose timing
    if (amiodaroneDose === 300 && amiodaroneFirstDoseShockCount === null) {
      setAmiodaroneFirstDoseShockCount(shockCount);
    }

    // Track when amiodarone reaches 450mg for Xylocaine timing
    if (newTotal >= 450 && amiodarone450ReachedTime === null) {
      setAmiodarone450ReachedTime(totalSeconds);
    }

    if (amiodaroneDose === 300) {
      setAmiodarone300Due(false);
      setAmiodarone300Dismissed(false);
      setAmiodarone300SnoozedUntil(null);
      // Reset audio tracking so it can play again for next activation
      playedAudioRef.current.amiodarone300 = false;
    } else if (amiodaroneDose === 150) {
      setAmiodarone150Due(false);
      setAmiodarone150Dismissed(false);
      setAmiodarone150SnoozedUntil(null);
      // Reset audio tracking so it can play again for next activation
      playedAudioRef.current.amiodarone150 = false;
    }

    addEvent('amiodarone', `Amiodarone ${amiodaroneDose}mg administered`, { dose: amiodaroneDose });

    setShowAmiodaroneDialog(false);

    toast.success(`Amiodarone ${amiodaroneDose}mg administered`, {
      duration: 4000,
      position: 'bottom-center',
      action: {
        label: 'Undo',
        onClick: () => {
          setAmiodaroneTotal(prev => prev - amiodaroneDose);
          if (amiodaroneDose === 300) {
            setAmiodaroneFirstDoseShockCount(prevFirstDoseShockCount);
          }
          setEvents(prev => prev.slice(0, -1));
        }
      }
    });
  };

  const handleSnoozeAmiodarone = () => {
    playClick();

    // Determine which dose to snooze
    const isShockable = currentRhythm === 'VF' || currentRhythm === 'pVT';
    const shouldSnooze300 = isShockable && shockCount >= 3 && amiodaroneTotal < 300 && !amiodarone300Dismissed;
    const shouldSnooze150 = isShockable && shockCount >= 5 && amiodaroneTotal >= 300 && amiodaroneTotal < 450 && !amiodarone150Dismissed;

    if (shouldSnooze300) {
      const prevSnoozedUntil = amiodarone300SnoozedUntil;
      const snoozeUntil = totalSeconds + 90;
      setAmiodarone300SnoozedUntil(snoozeUntil);
      // Keep audio flag true to prevent replay while snoozed

      toast.info('Amiodarone 300mg alarm snoozed for 90 seconds', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setAmiodarone300SnoozedUntil(prevSnoozedUntil);
          }
        }
      });
    } else if (shouldSnooze150) {
      const prevSnoozedUntil = amiodarone150SnoozedUntil;
      const snoozeUntil = totalSeconds + 90;
      setAmiodarone150SnoozedUntil(snoozeUntil);
      // Keep audio flag true to prevent replay while snoozed

      toast.info('Amiodarone 150mg alarm snoozed for 90 seconds', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setAmiodarone150SnoozedUntil(prevSnoozedUntil);
          }
        }
      });
    }
  };

  const handleDismissAmiodarone = (dose) => {
    playClick();
    
    // Determine which dose to dismiss based on current state
    const isShockable = currentRhythm === 'VF' || currentRhythm === 'pVT';
    const shouldDismiss300 = isShockable && shockCount >= 3 && amiodaroneTotal < 300 && !amiodarone300Dismissed;
    const shouldDismiss150 = isShockable && shockCount >= 5 && amiodaroneTotal >= 300 && amiodaroneTotal < 450 && !amiodarone150Dismissed;
    
    if (shouldDismiss300) {
      const prevDismissed = amiodarone300Dismissed;
      const prevShockCount = amiodaroneDismissedShockCount;
      setAmiodarone300Due(false);
      setAmiodarone300Dismissed(true);
      setAmiodaroneDismissedShockCount(shockCount);
      
      toast.info('Amiodarone 300mg alarm dismissed', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setAmiodarone300Dismissed(prevDismissed);
            setAmiodaroneDismissedShockCount(prevShockCount);
            setAmiodarone300Due(true);
          }
        }
      });
    } else if (shouldDismiss150) {
      const prevDismissed = amiodarone150Dismissed;
      const prevShockCount = amiodaroneDismissedShockCount;
      setAmiodarone150Due(false);
      setAmiodarone150Dismissed(true);
      setAmiodaroneDismissedShockCount(shockCount);
      
      toast.info('Amiodarone 150mg alarm dismissed', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setAmiodarone150Dismissed(prevDismissed);
            setAmiodaroneDismissedShockCount(prevShockCount);
            setAmiodarone150Due(true);
          }
        }
      });
    }
  };

  const [showLidocaineDialog, setShowLidocaineDialog] = useState(false);
  const [lidocaineDosePerKg, setLidocaineDosePerKg] = useState(1.5);
  const [patientWeight, setPatientWeight] = useState(60);
  const [lidocaineDoseNumber, setLidocaineDoseNumber] = useState(1); // Track which dose (1st, 2nd, or 3rd)
  
  const [showAmiodaroneDialog, setShowAmiodaroneDialog] = useState(false);
  const [amiodaroneDose, setAmiodaroneDose] = useState(300);
  const [amiodaroneDoseNumber, setAmiodaroneDoseNumber] = useState(1); // Track which dose (1st or 2nd)

  const handleConfirmLidocaine = (doseOrEvent) => {
    if (typeof doseOrEvent === 'object') {
      // Called from EventBanner with event object, show dialog
      // Determine which dose number based on how many times lidocaine was given
      const lidocaineGivenCount = events.filter(e => e.type === 'lidocaine').length;
      const doseNum = lidocaineGivenCount + 1; // 1, 2, or 3
      setLidocaineDoseNumber(doseNum);
      setLidocaineDosePerKg(doseNum === 1 ? 1.5 : 0.75); // Set default based on dose number
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
    // Check max dose limit (3 mg/kg)
    if (lidocaineCumulativeDose + lidocaineDosePerKg > 3) {
      toast.error('Cannot administer: Max dose 3 mg/kg is reached', {
        duration: 4000,
        position: 'bottom-center'
      });
      return;
    }

    const totalDose = lidocaineDosePerKg * patientWeight;
    playClick();
    setLidocaineCumulativeDose(prev => prev + lidocaineDosePerKg);
    setLastLidocaineTime(totalSeconds);

    // Clear the appropriate due/dismissed/snoozed flags based on dose number
    if (lidocaineDoseNumber === 1) {
      setLidocaine1mgDue(false);
      setLidocaine1mgDismissed(false);
      setLidocaine1mgSnoozedUntil(null);
      // Reset audio tracking so it can play again for next activation
      playedAudioRef.current.xylocaine = false;
    } else {
      setLidocaine05mgDue(false);
      setLidocaine05mgDismissed(false);
      setLidocaine05mgSnoozedUntil(null);
      // Reset audio tracking so it can play again for next activation
      playedAudioRef.current.xylocaine = false;
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

  const handleSnoozeLidocaine = () => {
    playClick();

    // Determine which dose to snooze
    const isShockable = currentRhythm === 'VF' || currentRhythm === 'pVT';
    const lidocaineGivenCount = events.filter(e => e.type === 'lidocaine').length;
    
    let shouldSnooze1mg = false;
    let shouldSnooze05mg = false;
    
    if (soundEnabled) {
      // Coach mode: Time-based logic
      if (isShockable && amiodarone450ReachedTime !== null && lidocaineCumulativeDose < 3) {
        const timeSinceAmio450 = totalSeconds - amiodarone450ReachedTime;
        const timeSinceLastLidocaine = lastLidocaineTime !== null ? totalSeconds - lastLidocaineTime : null;
        
        if (lidocaineGivenCount === 0) {
          shouldSnooze1mg = timeSinceAmio450 >= 360 && !lidocaine1mgDismissed;
        } else {
          shouldSnooze05mg = timeSinceLastLidocaine !== null && timeSinceLastLidocaine >= 360 && !lidocaine05mgDismissed;
        }
      }
    } else {
      // Track mode: Shock-based logic
      shouldSnooze1mg = isShockable && shockCount >= 8 && lidocaineGivenCount === 0 && lidocaineCumulativeDose < 3 && !lidocaine1mgDismissed;
      shouldSnooze05mg = isShockable && lidocaineGivenCount >= 1 && lidocaineCumulativeDose < 3 && !lidocaine05mgDismissed && (
        (shockCount >= 11 && lidocaineGivenCount === 1) ||
        (shockCount >= 14 && lidocaineGivenCount === 2) ||
        (shockCount >= 17 && lidocaineGivenCount === 3) ||
        (shockCount >= 20 && lidocaineGivenCount === 4) ||
        (shockCount >= 23 && lidocaineGivenCount >= 5)
      );
    }

    if (shouldSnooze1mg) {
      const prevSnoozedUntil = lidocaine1mgSnoozedUntil;
      const snoozeUntil = totalSeconds + 90;
      setLidocaine1mgSnoozedUntil(snoozeUntil);
      // Keep audio flag true to prevent replay while snoozed

      toast.info('Xylocaine 1st dose alarm snoozed for 90 seconds', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setLidocaine1mgSnoozedUntil(prevSnoozedUntil);
          }
        }
      });
    } else if (shouldSnooze05mg) {
      const prevSnoozedUntil = lidocaine05mgSnoozedUntil;
      const snoozeUntil = totalSeconds + 90;
      setLidocaine05mgSnoozedUntil(snoozeUntil);
      // Keep audio flag true to prevent replay while snoozed

      toast.info('Xylocaine subsequent dose alarm snoozed for 90 seconds', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setLidocaine05mgSnoozedUntil(prevSnoozedUntil);
          }
        }
      });
    }
  };

  const handleDismissLidocaine = (dose) => {
    playClick();
    
    // Determine which dose to dismiss based on current state
    const isShockable = currentRhythm === 'VF' || currentRhythm === 'pVT';
    const lidocaineGivenCount = events.filter(e => e.type === 'lidocaine').length;
    const shouldDismiss1mg = isShockable && shockCount >= 8 && lidocaineGivenCount === 0 && lidocaineCumulativeDose < 3 && !lidocaine1mgDismissed;
    const shouldDismiss05mg = isShockable && lidocaineGivenCount >= 1 && lidocaineCumulativeDose < 3 && !lidocaine05mgDismissed && (
      (shockCount >= 11 && lidocaineGivenCount === 1) ||
      (shockCount >= 14 && lidocaineGivenCount === 2) ||
      (shockCount >= 17 && lidocaineGivenCount === 3) ||
      (shockCount >= 20 && lidocaineGivenCount === 4) ||
      (shockCount >= 23 && lidocaineGivenCount >= 5)
    );
    
    if (shouldDismiss1mg) {
      const prevDismissed = lidocaine1mgDismissed;
      const prevDismissedTime = lidocaineDismissedTime;
      setLidocaine1mgDue(false);
      setLidocaine1mgDismissed(true);
      setLidocaineDismissedTime(totalSeconds);
      
      toast.info('Xylocaine 1st dose alarm dismissed', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setLidocaine1mgDismissed(prevDismissed);
            setLidocaineDismissedTime(prevDismissedTime);
            setLidocaine1mgDue(true);
          }
        }
      });
    } else if (shouldDismiss05mg) {
      const prevDismissed = lidocaine05mgDismissed;
      const prevDismissedTime = lidocaineDismissedTime;
      setLidocaine05mgDue(false);
      setLidocaine05mgDismissed(true);
      setLidocaineDismissedTime(totalSeconds);
      
      toast.info('Xylocaine subsequent dose alarm dismissed', {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setLidocaine05mgDismissed(prevDismissed);
            setLidocaineDismissedTime(prevDismissedTime);
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
    const prevShockCountAtChange = shockCountAtRhythmChange;
    
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
      
      // Track shock count at rhythm change for adrenaline crossover logic
      if (adrenalineCount > 0) {
        // Only track if we already had adrenaline (crossover from PEA/Asystole)
        setShockCountAtRhythmChange(shockCount);
      }
    }
    
    // Clear tracking if moving to non-shockable
    if (!nowIsShockable) {
      setShockCountAtRhythmChange(null);
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
          setShockCountAtRhythmChange(prevShockCountAtChange);
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
    const prevShockCount = shockCount;
    const prevShocksInRhythm = shocksInCurrentShockableRhythm;
    const prevCyclesWithShocks = new Set(cyclesWithShocks);
    const prevShockDelivered = shockDeliveredThisCycle;

    setShockCount(prev => prev + 1);
    setShocksInCurrentShockableRhythm(prev => prev + 1);

    // Track that this cycle had a shock (for medication timing)
    setCyclesWithShocks(prev => new Set([...prev, currentCycle]));

    // In coach mode, lock shock button after first shock
    // In track mode, allow multiple shocks per cycle
    if (soundEnabled) {
      setShockDeliveredThisCycle(true);
    }

    addEvent('shock', `Shock delivered @ ${energy}J (Shock #${shockCount + 1})`, { 
      energy, 
      rhythmBefore: currentRhythm 
    });

    // Count shocks in this cycle for warning message
    const shocksThisCycle = events.filter(e => e.type === 'shock' && e.cycle === currentCycle).length + 1;

    // Show warning if delivering more than 1 shock per cycle in track mode
    if (!soundEnabled && shocksThisCycle > 1) {
      toast.warning(`⚠️ Multiple shocks in cycle ${currentCycle} (${shocksThisCycle} shocks)`, {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setShockCount(prevShockCount);
            setShocksInCurrentShockableRhythm(prevShocksInRhythm);
            setCyclesWithShocks(prevCyclesWithShocks);
            setShockDeliveredThisCycle(prevShockDelivered);
            setEvents(prev => prev.slice(0, -1));
          }
        }
      });
    } else {
      toast.success(`Shock delivered @ ${energy}J`, {
        duration: 4000,
        position: 'bottom-center',
        action: {
          label: 'Undo',
          onClick: () => {
            setShockCount(prevShockCount);
            setShocksInCurrentShockableRhythm(prevShocksInRhythm);
            setCyclesWithShocks(prevCyclesWithShocks);
            setShockDeliveredThisCycle(prevShockDelivered);
            setEvents(prev => prev.slice(0, -1));
          }
        }
      });
    }
  };

  const handleEndSession = async () => {
    setIsRunning(false);
    setSessionEnded(true);
    setFinalOutcome(outcome);
    
    // Add session end event to the events log
    addEvent('end', `CPR Session Ended (Outcome: ${outcome})`, { outcome });
    
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

  const exportGuestPDF = async () => {
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

    // Summary boxes - format date properly
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const formattedStartTime = startTime ? (() => {
      try {
        const date = new Date(startTime);
        if (!isNaN(date.getTime())) {
          const formatted = date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          // Format as "Jan 5, 2026 00:10" (keep comma, replace space between date and time)
          return formatted.replace(/(\d{4}) (\d{2}:\d{2})/, '$1 $2');
        }
      } catch (e) {}
      return startTime;
    })() : 'N/A';
    doc.text(`Start: ${formattedStartTime}`, 15, yPos);
    doc.text(`Duration: ${formatTime(totalSeconds)}`, 70, yPos);
    doc.text(`Cycles: ${currentCycle}`, 125, yPos);
    yPos += 6;
    doc.text(`Outcome: ${outcomeText}`, 15, yPos);
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
          // Format as "Rhythm Check: VF" instead of "Rhythm identified: VF"
          const rhythmMatch = e.message.match(/Rhythm identified: (\w+)/);
          if (rhythmMatch) {
            description = `Rhythm Check: ${rhythmMatch[1]}`;
          } else {
            description = e.message.replace('Rhythm identified: ', 'Rhythm Check: ');
          }
          break;
        case 'shock':
          description = `Shock Delivered @ ${e.energy}J (Rhythm: ${e.rhythmBefore})`;
          break;
        case 'compressor':
          // Simplify compressor messages to "Compressor Changed"
          if (e.message.includes('Compressor changed') || e.message.includes('compressor changed')) {
            description = 'Compressor Changed';
          } else if (e.message.includes('LUCAS')) {
            description = e.message;
          } else {
            description = 'Compressor Changed';
          }
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
          // Skip cycle start events in the report
          return null;
        case 'end':
          description = `CPR Session Ended (Outcome: ${formatOutcome(e.outcome)})`;
          break;
        default:
          description = e.message;
      }

      if (description === null) return null;
      return [e.timestamp, description, `Cycle ${e.cycle || '-'}`];
    };

    if (events.length > 0) {
      doc.setFontSize(11);
      doc.text('Event Log', 15, yPos);
      yPos += 5;

      let filteredEvents = events.filter(e => 
        e.type !== 'start' && 
        e.type !== 'cycle' && 
        e.type !== 'end' &&  // Filter out end events, we'll add a properly formatted one
        !e.message?.includes('Time adjusted') &&
        !e.message?.includes('Cycle') &&
        !e.message?.includes('started')
      );

      // Add session end event if session has ended (with Cycle -)
      if (sessionEnded && finalOutcome) {
        const endEvent = {
          type: 'end',
          timestamp: new Date().toLocaleTimeString(),
          cycle: '-',
          outcome: finalOutcome
        };
        filteredEvents = [...filteredEvents, endEvent];
      }

      const tableRows = filteredEvents.map(formatEventForPDF).filter(row => row !== null);

      if (tableRows.length > 0) {
        doc.autoTable({
          startY: yPos,
          head: [['Time', 'Event', 'Cycle']],
          body: tableRows,
          theme: 'striped',
          styles: { fontSize: 8 },
          margin: { left: 15 },
          headStyles: { fillColor: [30, 64, 175] }
        });
        yPos = doc.lastAutoTable.finalY + 8;
      }
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

    // Download PDF - use native file handling in Capacitor
    const fileName = `CPR_Session_${new Date().toISOString().slice(0, 10)}_${new Date().getTime()}.pdf`;
    
    if (Capacitor.isNativePlatform()) {
      try {
        // Generate PDF as base64
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        
        // Save to Cache directory (more accessible for sharing on iOS)
        const result = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
          recursive: true
        });
        
        // Get the file URI - use getUri to ensure proper format
        const uriResult = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache
        });
        
        // Share the file (opens native share sheet - allows save, share, print)
        await Share.share({
          title: 'CPR Session Report',
          text: 'CPR Session Report PDF',
          url: uriResult.uri,
          dialogTitle: 'Share CPR Report'
        });
        
        toast.success('PDF ready to share or save', {
          duration: 3000,
          position: 'bottom-center'
        });
      } catch (error) {
        console.error('Error exporting PDF:', error);
        toast.error('Failed to export PDF. Please try again.', {
          duration: 3000,
          position: 'bottom-center'
        });
      }
    } else {
      // For web: Use standard save method
      doc.save(fileName);
    }
  };

  const exportHTML = async () => {
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

    let filteredEvents = events.filter(e => 
      e.type !== 'start' && 
      e.type !== 'cycle' && 
      e.type !== 'end' &&  // Filter out end events, we'll add a properly formatted one
      !e.message?.includes('Time adjusted') &&
      !e.message?.includes('Cycle') &&
      !e.message?.includes('started')
    );

    // Add session end event if session has ended (with Cycle -)
    if (sessionEnded && finalOutcome) {
      const endEvent = {
        type: 'end',
        timestamp: new Date().toLocaleTimeString(),
        cycle: '-',
        outcome: finalOutcome
      };
      filteredEvents = [...filteredEvents, endEvent];
    }

    const formatEventForHTML = (e) => {
      let description = '';
      switch (e.type) {
        case 'rhythm':
          // Format as "Rhythm Check: VF" instead of "Rhythm identified: VF"
          const rhythmMatch = e.message.match(/Rhythm identified: (\w+)/);
          if (rhythmMatch) {
            description = `Rhythm Check: ${rhythmMatch[1]}`;
          } else {
            description = e.message.replace('Rhythm identified: ', 'Rhythm Check: ');
          }
          break;
        case 'shock':
          description = `Shock Delivered @ ${e.energy}J (Rhythm: ${e.rhythmBefore})`;
          break;
        case 'compressor':
          // Simplify compressor messages to "Compressor Changed"
          if (e.message.includes('Compressor changed') || e.message.includes('compressor changed')) {
            description = 'Compressor Changed';
          } else if (e.message.includes('LUCAS')) {
            description = e.message;
          } else {
            description = 'Compressor Changed';
          }
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
        case 'end':
          description = `CPR Session Ended (Outcome: ${formatOutcome(e.outcome)})`;
          break;
        default:
          description = e.message;
      }
      return `<tr><td>${e.timestamp}</td><td>${description}</td><td>Cycle ${e.cycle || '-'}</td></tr>`;
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>CPR Session Report</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body {
            font-family: 'Sarabun', 'Tahoma', Arial, sans-serif;
            margin: 20px;
            color: #1e293b;
          }
          h1 {
            color: #1e40af;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .summary-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
          }
          .summary-box p {
            margin: 5px 0;
          }
          .warning {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            color: #92400e;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th {
            background: #1e40af;
            color: white;
            padding: 10px;
            text-align: left;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .notes {
            margin-top: 20px;
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
          }
          .notes h3 {
            margin-top: 0;
            color: #1e40af;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
          }
          .print-button {
            background: #1e40af;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 20px;
          }
          .print-button:hover {
            background: #1e3a8a;
          }
        </style>
      </head>
      <body>
        <button onclick="window.print()" class="print-button no-print">🖨️ Print / Save as PDF</button>

        <h1>CPR Session Report</h1>

        <div class="summary-box">
          <p><strong>Start:</strong> ${(() => {
            if (!startTime) return 'N/A';
            try {
              const date = new Date(startTime);
              if (!isNaN(date.getTime())) {
                const formatted = date.toLocaleString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                });
                // Format as "Jan 5, 2026 00:10" (keep comma, replace space between date and time)
                return formatted.replace(/(\d{4}) (\d{2}:\d{2})/, '$1 $2');
              }
            } catch (e) {}
            return startTime;
          })()}</p>
          <p><strong>Duration:</strong> ${formatTime(totalSeconds)}</p>
          <p><strong>Cycles:</strong> ${currentCycle}</p>
          <p><strong>Outcome:</strong> ${outcomeText}</p>
        </div>

        ${(!sessionEnded || !finalOutcome) ? `
          <div class="warning">
            <strong>⚠️ Warning:</strong> CPR Effort Ongoing - Final outcome not determined
          </div>
        ` : ''}

        <div class="summary-box">
          <h3>Summary</h3>
          <p>
            <strong>Shocks:</strong> ${shockCount} | 
            <strong>Adrenaline:</strong> ${adrenalineCount} | 
            <strong>Amiodarone:</strong> ${amiodaroneTotal}mg | 
            <strong>Lidocaine:</strong> ${lidocaineCumulativeDose} mg/kg | 
            <strong>Compressor Changes:</strong> ${compressorChanges}
          </p>
        </div>

        ${filteredEvents.length > 0 ? `
          <h3>Event Log</h3>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Cycle</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEvents.map(formatEventForHTML).join('')}
            </tbody>
          </table>
        ` : ''}

        ${doctorNotes ? `
          <div class="notes">
            <h3>Note1 (During CPR)</h3>
            <p>${doctorNotes.replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}

        ${notes ? `
          <div class="notes">
            <h3>Note2 (End Session)</h3>
            <p>${notes.replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}

        <div class="footer">
          Generated: ${new Date().toLocaleString()} | CPR Tracker - ACLS Compliant
        </div>
      </body>
      </html>
    `;

    // Export HTML - use native file handling in Capacitor
    const fileName = `CPR_Session_${new Date().toISOString().slice(0, 10)}_${new Date().getTime()}.html`;
    
    if (Capacitor.isNativePlatform()) {
      try {
        // Convert HTML to base64
        const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
        
        // Save to Cache directory (more accessible for sharing on iOS)
        const result = await Filesystem.writeFile({
          path: fileName,
          data: htmlBase64,
          directory: Directory.Cache,
          recursive: true
        });
        
        // Get the file URI - use getUri to ensure proper format
        const uriResult = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache
        });
        
        // Share the file (opens native share sheet - allows save, share, print)
        await Share.share({
          title: 'CPR Session Report',
          text: 'CPR Session Report HTML',
          url: uriResult.uri,
          dialogTitle: 'Share CPR Report'
        });
        
        toast.success('HTML report ready to share or save', {
          duration: 3000,
          position: 'bottom-center'
        });
      } catch (error) {
        console.error('Error exporting HTML:', error);
        toast.error('Failed to export HTML. Please try again.', {
          duration: 3000,
          position: 'bottom-center'
        });
      }
    } else {
      // For web: Use blob URL
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <Toaster position="bottom-center" richColors />

      {/* Header - Auto-hiding */}
      <div 
        className={`max-w-6xl mx-auto mb-6 transition-all duration-300 ease-in-out ${
          headerVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        style={{ 
          maxHeight: headerVisible ? '200px' : '0px',
          overflow: headerVisible ? 'visible' : 'hidden'
        }}
      >
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
                onClick={() => {
                  setShowConfirmEnd(true);
                  // Show header briefly when clicking end session, then auto-hide
                  setHeaderVisible(true);
                  if (headerHideTimerRef.current) {
                    clearTimeout(headerHideTimerRef.current);
                  }
                  headerHideTimerRef.current = setTimeout(() => {
                    setHeaderVisible(false);
                  }, 3000);
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-6 h-12 text-lg font-semibold"
              >
                <Square className="w-5 h-5 mr-2" />
                End Session
              </Button>
            )}

            <Button 
              onClick={() => setShowExportDialog(true)}
              variant="outline"
              className="border-blue-600 text-blue-400 hover:bg-blue-900/50 h-12"
              disabled={totalSeconds === 0}
            >
              <FileText className="w-5 h-5 mr-2" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Swipeable Pages */}
      <div className="max-w-6xl mx-auto pb-16">
        <Carousel 
          className="w-full" 
          opts={{ 
            align: "start",
            loop: true,
            dragFree: false,
          }}
          setApi={(api) => {
            // Store carousel API for page indicator navigation
            if (api) {
              carouselApiRef.current = api;
              
              // Listen to slide changes to update current page
              api.on('select', () => {
                // Handle looping - ensure page is always 0, 1, or 2
                const selectedIndex = api.selectedScrollSnap();
                setCurrentPage(selectedIndex % 3);
              });
              
              // Set initial page
              const initialIndex = api.selectedScrollSnap();
              setCurrentPage(initialIndex % 3);
            }
          }}
        >
          <CarouselContent className="-ml-0">
            {/* Page 1: Timer/Cycle Tracker and Event Log */}
            <CarouselItem className="pl-0">
              <div className="space-y-6 pb-6">
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
                  adrenalineFrequency={adrenalineFrequency}
                  lastAdrenalineTime={lastAdrenalineTime}
                />

                {/* Event Log */}
                <EventLog events={events} />
              </div>
            </CarouselItem>

            {/* Page 2: Rhythm Selector and Event Banners */}
            <CarouselItem className="pl-0">
              <div className="space-y-6 pb-6">
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
                  soundEnabled={soundEnabled}
                />

                {/* Event Banners */}
                <EventBanner 
                  events={bannerEvents}
                  onConfirmCompressorChange={handleConfirmCompressorChange}
                  onConfirmPulseCheck={handleConfirmPulseCheck}
                  onConfirmAdrenaline={handleConfirmAdrenaline}
                  onDismissAdrenaline={handleDismissAdrenaline}
                  onSnoozeAdrenaline={handleSnoozeAdrenaline}
                  onConfirmAmiodarone={handleConfirmAmiodarone}
                  onDismissAmiodarone={handleDismissAmiodarone}
                  onSnoozeAmiodarone={handleSnoozeAmiodarone}
                  onConfirmLidocaine={handleConfirmLidocaine}
                  onDismissLidocaine={handleDismissLidocaine}
                  onSnoozeLidocaine={handleSnoozeLidocaine}
                  onAdrenalineFrequencyChange={handleAdrenalineFrequencyChange}
                  onSyncPulseCheck={handleSyncPulseCheck}
                  pulseCheckSynced={pulseCheckSynced}
                  lucasActive={lucasActive}
                  onToggleLucas={handleToggleLucas}
                  soundEnabled={soundEnabled}
                  adrenalineSnoozed={adrenalineSnoozedUntil !== null && totalSeconds < adrenalineSnoozedUntil}
                  amiodaroneSnoozed={(amiodarone300SnoozedUntil !== null && totalSeconds < amiodarone300SnoozedUntil) || (amiodarone150SnoozedUntil !== null && totalSeconds < amiodarone150SnoozedUntil)}
                  lidocaineSnoozed={(lidocaine1mgSnoozedUntil !== null && totalSeconds < lidocaine1mgSnoozedUntil) || (lidocaine05mgSnoozedUntil !== null && totalSeconds < lidocaine05mgSnoozedUntil)}
                  adrenalineSnoozeRemaining={adrenalineSnoozedUntil !== null && totalSeconds < adrenalineSnoozedUntil ? Math.max(0, adrenalineSnoozedUntil - totalSeconds) : null}
                  amiodaroneSnoozeRemaining={(() => {
                    if (amiodarone300SnoozedUntil !== null && totalSeconds < amiodarone300SnoozedUntil) {
                      return Math.max(0, amiodarone300SnoozedUntil - totalSeconds);
                    }
                    if (amiodarone150SnoozedUntil !== null && totalSeconds < amiodarone150SnoozedUntil) {
                      return Math.max(0, amiodarone150SnoozedUntil - totalSeconds);
                    }
                    return null;
                  })()}
                  lidocaineSnoozeRemaining={(() => {
                    if (lidocaine1mgSnoozedUntil !== null && totalSeconds < lidocaine1mgSnoozedUntil) {
                      return Math.max(0, lidocaine1mgSnoozedUntil - totalSeconds);
                    }
                    if (lidocaine05mgSnoozedUntil !== null && totalSeconds < lidocaine05mgSnoozedUntil) {
                      return Math.max(0, lidocaine05mgSnoozedUntil - totalSeconds);
                    }
                    return null;
                  })()}
                  disabled={!hasStarted}
                />
              </div>
            </CarouselItem>

            {/* Page 3: Common Medications, Procedures, and Notes */}
            <CarouselItem className="pl-0">
              <div className="space-y-6 pb-6">
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

                {/* Notes Section */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
                  <label className="text-slate-300 font-semibold mb-2 block">
                    📝 Notes
                  </label>
                  <textarea
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value.slice(0, 400))}
                    onBlur={(e) => {
                      // Reset zoom on iOS when textarea loses focus
                      if (Capacitor.isNativePlatform()) {
                        window.scrollTo(0, 0);
                        document.body.scrollTop = 0;
                        document.documentElement.scrollTop = 0;
                      }
                    }}
                    placeholder="text or talk"
                    maxLength={400}
                    rows={6}
                    disabled={!hasStarted}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white text-base resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontSize: '16px' }}
                  />
                  <div className="text-xs text-slate-500 mt-1 text-right">
                    {doctorNotes.length}/400 characters
                  </div>
                </div>
              </div>
            </CarouselItem>
          </CarouselContent>
        </Carousel>
        
        {/* Page Indicator Dots */}
        <div className="flex justify-center items-center gap-3 mt-4 mb-4 fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          {[0, 1, 2].map((index) => (
            <button
              key={index}
              onClick={() => {
                if (carouselApiRef.current) {
                  carouselApiRef.current.scrollTo(index);
                }
              }}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                currentPage === index
                  ? 'bg-blue-500 w-8'
                  : 'bg-slate-600 hover:bg-slate-500'
              }`}
              aria-label={`Go to page ${index + 1}`}
            />
          ))}
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

      {/* Amiodarone Dialog */}
      <Dialog open={showAmiodaroneDialog} onOpenChange={setShowAmiodaroneDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Administer Amiodarone {soundEnabled && `(Dose ${amiodaroneDoseNumber})`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">Select Dose</label>
              <div className="grid grid-cols-2 gap-3">
                {(!soundEnabled || amiodaroneDoseNumber === 1) && (
                  <Button
                    variant={amiodaroneDose === 300 ? "default" : "outline"}
                    className={`h-16 text-lg font-bold ${
                      amiodaroneDose === 300 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                        : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                    } ${soundEnabled && amiodaroneDoseNumber === 1 ? 'col-span-2' : ''}`}
                    onClick={() => setAmiodaroneDose(300)}
                  >
                    300 mg
                  </Button>
                )}
                {(!soundEnabled || amiodaroneDoseNumber === 2) && (
                  <Button
                    variant={amiodaroneDose === 150 ? "default" : "outline"}
                    className={`h-16 text-lg font-bold ${
                      amiodaroneDose === 150 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                        : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                    } ${soundEnabled && amiodaroneDoseNumber === 2 ? 'col-span-2' : ''}`}
                    onClick={() => setAmiodaroneDose(150)}
                  >
                    150 mg
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4">
              <div className="text-purple-300 text-sm mb-1">Selected Dose</div>
              <div className="text-white text-3xl font-bold">
                {amiodaroneDose} mg
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowAmiodaroneDialog(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAmiodaroneSubmit}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
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
              Administer Xylocaine (Lidocaine) {soundEnabled && `(Dose ${lidocaineDoseNumber})`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">Dose per kg</label>
              <div className={`grid gap-2 ${soundEnabled ? 'grid-cols-2' : 'grid-cols-4'}`}>
                {[0.5, 0.75, 1.0, 1.5].filter(dose => {
                  // In coach mode, filter based on dose number
                  if (!soundEnabled) return true; // Track mode: show all
                  if (lidocaineDoseNumber === 1) return dose === 1.0 || dose === 1.5; // First dose: 1.0 or 1.5
                  return dose === 0.5 || dose === 0.75; // Second/third dose: 0.5 or 0.75
                }).map((dose) => (
                  <Button
                    key={dose}
                    variant={lidocaineDosePerKg === dose ? "default" : "outline"}
                    className={`h-14 text-base font-bold ${
                      lidocaineDosePerKg === dose 
                        ? 'bg-teal-600 hover:bg-teal-700 text-white' 
                        : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                    }`}
                    onClick={() => setLidocaineDosePerKg(dose)}
                  >
                    {dose}
                  </Button>
                ))}
              </div>
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

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Export Report</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Choose export format:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">

            <Button
              onClick={() => {
                exportHTML();
                setShowExportDialog(false);
              }}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold"
            >
              <FileText className="w-5 h-5 mr-2" />
              HTML Report
            </Button>

            <Button
              onClick={() => {
                exportGuestPDF();
                setShowExportDialog(false);
              }}
              variant="outline"
              className="w-full h-14 border-slate-600 text-slate-300 hover:bg-slate-800 text-lg font-semibold"
            >
              <FileText className="w-5 h-5 mr-2" />
              PDF Download
            </Button>
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