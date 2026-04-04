import React, { useState, useEffect, useRef } from 'react';
import { Activity, Droplet, Clock, Moon, AlertTriangle, CheckCircle, UploadCloud, FileText, FastForward } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import CircularProgress from '../components/CircularProgress';
import CBTGraph from '../components/CBTGraph';
import ProfileCard from '../components/ProfileCard';
import HydrationAlertPopup from '../components/HydrationAlertPopup';
import { io } from 'socket.io-client';

// Generate mock stages simulating a real sleep night.
const generateMockStages = () => {
  const stages = [];
  const addStage = (type, count, startIdx) => {
    for (let i = 0; i < count; i++) {
       stages.push({
         epoch_index: startIdx + i,
         stage: type,
         start_time: new Date(Date.now() + (startIdx + i) * 30000).toISOString()
       });
    }
    return startIdx + count;
  };
  
  let i = 0;
  i = addStage("AWAKE", 5, i);
  i = addStage("N1", 10, i);
  i = addStage("N2", 30, i);
  i = addStage("N3", 40, i);
  i = addStage("N2", 15, i);
  i = addStage("REM", 30, i);
  i = addStage("N2", 20, i);
  i = addStage("N3", 30, i);
  i = addStage("REM", 40, i);
  addStage("AWAKE", 2, i);
  return stages;
};

const mockDataTemplate = {
  sleep_score: 7,
  sleep_quality: "GOOD",
  hydration_status: "LOW_RISK",
  wake_time: new Date(Date.now() + 8*60*60*1000).toISOString(),
  sleep_stages: generateMockStages(),
  explanation: "Overall sleep quality was GOOD. Core body temperature dropped appropriately. Heart rate dropped to a healthy resting level. Respiration rate was stable. Skin temperature rose appropriately. Movement was low during sleep.",
  suggestions: [
    "Drink 1–2 glasses of water in the hour before bedtime.",
    "Avoid alcohol and high-sodium foods close to sleep time to prevent fluid loss."
  ]
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [fullDataset, setFullDataset] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Profile Architecture
  const [profile, setProfile] = useState({ name: 'Astronaut One', age: 28, gender: 'Male' });

  // Terminal & Streaming States
  const [terminalLogs, setTerminalLogs] = useState(["[SYSTEM] Awaiting smart patch tether..."]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState({ hr: '--', rr: '--', hrv: '--' }); // Real-time biometric storage
  const terminalContainerRef = useRef(null);

  const [patchStatus, setPatchStatus] = useState('Patch disconnected');
  const [isUploading, setIsUploading] = useState(false);
  const [hydrationAlert, setHydrationAlert] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (terminalContainerRef.current) {
      const el = terminalContainerRef.current;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isAtBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [terminalLogs]);

  useEffect(() => {
    // Connect to WebSocket server for real-time hydration alerts
    // TODO: Replace dummyUserId with the authenticated user's ID from auth state
    const socket = io('http://localhost:5001');
    const dummyUserId = 'mock_user_123';
    socket.emit('join_user_room', dummyUserId);

    socket.on('hydration_alert', (alertData) => {
      console.log('🚨 Received hydration alert via WS:', alertData);
      setHydrationAlert(alertData);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setData(mockDataTemplate);
    }, 800);
  }, []);

  // --- Live Stream Simulator (Terminal Feed) ---
  const startBiometricStream = (dataset) => {
    setIsStreaming(true);
    setTerminalLogs(["[SYSTEM] Handshake verified. Streaming biometrics at accelerated feed..."]);
    
    // Pick daylight hours out of the dataset or just stream chronologically
    let pointer = 0;
    let alertCooldown = 0;
    
    const intervalId = setInterval(() => {
       if (pointer >= dataset.length - 30) {
         clearInterval(intervalId);
         setIsStreaming(false);
         setTerminalLogs(prev => [...prev, "[SYSTEM] End of biometric stream reached."]);
         return;
       }

       // Grab a 15-minute moving window (30 epochs)
       const windowData = dataset.slice(pointer, pointer + 30);
       const first = windowData[0];
       const last = windowData[windowData.length - 1];
       
       const cbtSlope = last.cbt - first.cbt;
       
       const timeStr = new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit' });
       let trend = cbtSlope > 0 ? "RISING ▲" : (cbtSlope < 0 ? "FALLING ▼" : "STABLE ■");
       
       const logMsg = `[${timeStr}] CBT: ${last.cbt.toFixed(2)}°C | HR: ${last.hr || '--'} | Trend: ${trend}`;
       setTerminalLogs(prev => [...prev.slice(-30), logMsg]);
       
       // Update visual metric bars
       setLiveMetrics({ hr: last.hr || '--', rr: last.rr || '--', hrv: last.hrv || '--' });

       // Dehydration trip-wire simulation (cbt rising, no extreme movement)
       let ascendingCount = 0;
       for(let j=1; j<30; j++) { if (windowData[j].cbt >= windowData[j-1].cbt - 0.02) ascendingCount++; }
       const avgMove = windowData.reduce((sum, d) => sum + d.move, 0) / 30;

       if (alertCooldown > 0) {
         alertCooldown -= 30;
       } else if (cbtSlope >= 0.20 && ascendingCount >= 20 && avgMove < 0.6) {
         // TRIPPED - Push the alert and set a cooldown block but DO NOT stop the stream
         setTerminalLogs(prev => [...prev, `[!!!] DEHYDRATION DETECTED. Dispatching alert payload.`]);
         setHydrationAlert({
           type: 'MILD_RISK',
           message: '⚠️ Hydration Alert\n\nYour body temperature is rising continuously.\nYou may be getting dehydrated.\n\nDrink water immediately to balance your thermoregulation.'
         });
         alertCooldown = 120; // 60 mins cooldown (120 epochs of 30sec) before next alert
       }

       pointer += 30; // Step through time
    }, 400); // 400ms represents ~15 real-world minutes processed immediately
  };

  // --- Circadian Window Algorithms ---
  const WINDOW = 40; // 20 mins of 30s epochs

  // ── Dual-Axis Thresholds: 6 Age Groups × 2 Sex Profiles (Report §4) ──
  // Female: relaxed N3 (smaller thermoregulatory amplitude),
  //   tighter REM_RISE (higher autonomic variability), adjusted MOVE_TH
  const AGE_SEX_THRESHOLDS = {
    CHILD: {
      M: { N3_LOWER: -0.60, N2_LOWER: -0.60, N1_LOWER: -0.25, REM_RISE: 0.14, AWAKE_VAR: 0.18, MOVE_TH: 0.07, ONSET_MOVE: 0.25 },
      F: { N3_LOWER: -0.55, N2_LOWER: -0.55, N1_LOWER: -0.23, REM_RISE: 0.12, AWAKE_VAR: 0.18, MOVE_TH: 0.065, ONSET_MOVE: 0.25 },
    },
    TEEN: {
      M: { N3_LOWER: -0.50, N2_LOWER: -0.55, N1_LOWER: -0.20, REM_RISE: 0.12, AWAKE_VAR: 0.16, MOVE_TH: 0.07, ONSET_MOVE: 0.30 },
      F: { N3_LOWER: -0.45, N2_LOWER: -0.50, N1_LOWER: -0.18, REM_RISE: 0.10, AWAKE_VAR: 0.16, MOVE_TH: 0.065, ONSET_MOVE: 0.30 },
    },
    YOUNG: {
      M: { N3_LOWER: -0.50, N2_LOWER: -0.50, N1_LOWER: -0.20, REM_RISE: 0.10, AWAKE_VAR: 0.15, MOVE_TH: 0.05, ONSET_MOVE: 0.35 },
      F: { N3_LOWER: -0.45, N2_LOWER: -0.45, N1_LOWER: -0.18, REM_RISE: 0.08, AWAKE_VAR: 0.15, MOVE_TH: 0.045, ONSET_MOVE: 0.35 },
    },
    MID: {
      M: { N3_LOWER: -0.40, N2_LOWER: -0.50, N1_LOWER: -0.22, REM_RISE: 0.08, AWAKE_VAR: 0.14, MOVE_TH: 0.085, ONSET_MOVE: 0.30 },
      F: { N3_LOWER: -0.35, N2_LOWER: -0.45, N1_LOWER: -0.20, REM_RISE: 0.06, AWAKE_VAR: 0.14, MOVE_TH: 0.075, ONSET_MOVE: 0.30 },
    },
    OLDER: {
      M: { N3_LOWER: -0.35, N2_LOWER: -0.48, N1_LOWER: -0.25, REM_RISE: 0.06, AWAKE_VAR: 0.12, MOVE_TH: 0.085, ONSET_MOVE: 0.25 },
      F: { N3_LOWER: -0.30, N2_LOWER: -0.43, N1_LOWER: -0.22, REM_RISE: 0.05, AWAKE_VAR: 0.12, MOVE_TH: 0.075, ONSET_MOVE: 0.25 },
    },
    ELDERLY: {
      M: { N3_LOWER: -0.30, N2_LOWER: -0.45, N1_LOWER: -0.28, REM_RISE: 0.05, AWAKE_VAR: 0.10, MOVE_TH: 0.10, ONSET_MOVE: 0.20 },
      F: { N3_LOWER: -0.25, N2_LOWER: -0.40, N1_LOWER: -0.25, REM_RISE: 0.04, AWAKE_VAR: 0.10, MOVE_TH: 0.09, ONSET_MOVE: 0.20 },
    },
  };

  const getAgeGroup = (age) => {
    if (age <= 12) return 'CHILD';
    if (age <= 19) return 'TEEN';
    if (age <= 39) return 'YOUNG';
    if (age <= 59) return 'MID';
    if (age <= 75) return 'OLDER';
    return 'ELDERLY';
  };

  const getSexKey = (gender) => gender === 'Female' ? 'F' : 'M';

  const getThresholds = (age, gender) => {
    const ageGroup = getAgeGroup(age);
    const sexKey = getSexKey(gender);
    return { ageGroup, sexKey, ...AGE_SEX_THRESHOLDS[ageGroup][sexKey] };
  };

  // ── Sleep Onset Detection (Report §3.1: DPG-Integrated "Cooling Trend") ──
  // Fix: DPG (skin - cbt) positive shift = vasodilation → sleep imminent
  // Path A: Classical CBT drop + 70% consistency + low movement
  // Path B: DPG shortcut — strong vasodilation + CBT dropping + low movement
  const findSleepOnset = (dataset, startIdx, onsetMoveThresh = 0.35) => {
    for (let i = startIdx; i <= dataset.length - WINDOW; i++) {
      const slice = dataset.slice(i, i + WINDOW);
      const startCbt = slice[0].cbt;
      const endCbt = slice[WINDOW - 1].cbt;

      const isCbtDropping = (startCbt - endCbt) > 0.05;

      let descendingCount = 0;
      for(let j=1; j<WINDOW; j++) { if (slice[j].cbt <= slice[j-1].cbt + 0.03) descendingCount++; }
      const consistency = descendingCount >= WINDOW * 0.7;
      
      const avgMove = slice.reduce((sum, d) => sum + d.move, 0) / WINDOW;
      const moveLow = avgMove < onsetMoveThresh;

      // DPG shift: positive = distal vasodilation onset (Report §3.1)
      const startDPG = slice[0].skin - slice[0].cbt;
      const endDPG = slice[WINDOW - 1].skin - slice[WINDOW - 1].cbt;
      const isDPGPositive = (endDPG - startDPG) > 0.15;

      if ((isCbtDropping && consistency && moveLow) ||
          (isDPGPositive && isCbtDropping && moveLow)) {
        return i; 
      }
    }
    return startIdx;
  };

  // ── Wake Detection (Report §3.2: Dynamic Hysteresis Lock) ──
  // DEFAULT LOCK: 3 hours (360 epochs) before thermal wake scan starts
  // BYPASS: If sustained high movement + elevated HR persists for 30 epochs
  //   → pathological early wake (insomnia/fragmentation) — lock overridden
  const WAKE_WINDOW = 60;        // 30 min at 30s/epoch
  const MIN_SLEEP_EPOCHS = 360;  // 3h default physiological lock
  const BYPASS_MOTION_WINDOW = 30; // 15 min high-motion bypass window

  const findWakeTime = (dataset, sleepIdx, hrBaseline = 70) => {
    if (sleepIdx == null) return dataset.length - 1;

    // ── BYPASS CHECK: Insomnia / Pathological Early Wake ──
    // Scan from sleepIdx+30 (15 min min) — much shorter than 3h lock
    const bypassStart = sleepIdx + 30;
    for (let b = bypassStart; b <= dataset.length - BYPASS_MOTION_WINDOW; b++) {
      const bypassSlice = dataset.slice(b, b + BYPASS_MOTION_WINDOW);
      const allHighMotion = bypassSlice.every(d => d.move > 0.25);
      const avgHR = bypassSlice.reduce((s, d) => s + (d.hr || 70), 0) / BYPASS_MOTION_WINDOW;
      const hrElevated = avgHR > hrBaseline * 1.1;
      if (allHighMotion && hrElevated) {
        return b + Math.floor(BYPASS_MOTION_WINDOW / 2);
      }
    }

    // ── STANDARD LOCK: Normal wake via sustained CBT rise ──
    const startScan = sleepIdx + MIN_SLEEP_EPOCHS;
    if (startScan >= dataset.length - WAKE_WINDOW) return dataset.length - 1;

    for (let i = startScan; i <= dataset.length - WAKE_WINDOW; i++) {
       const slice = dataset.slice(i, i + WAKE_WINDOW);
       const startCbt = slice[0].cbt;
       const endCbt = slice[WAKE_WINDOW - 1].cbt;
       const isCbtRising = (endCbt - startCbt) > 0.03;
       let ascendingCount = 0;
       for(let j=1; j<WAKE_WINDOW; j++) { if (slice[j].cbt >= slice[j-1].cbt - 0.02) ascendingCount++; }
       if (isCbtRising && ascendingCount >= WAKE_WINDOW * 0.5) {
         return i + Math.floor(WAKE_WINDOW / 2);
       }
    }
    return dataset.length - 1;
  };

  const processNight = (dataset, startIdx, currentProfile) => {
    if (startIdx >= dataset.length - WINDOW) return; // Out of data
    
    setIsUploading(true);
    
    // ── Upgrade 1: Sex-Based Dual-Axis Threshold Lookup ──
    const ageRaw = Number(currentProfile?.age || 28);
    const genderRaw = currentProfile?.gender || 'Male';
    const thresholds = getThresholds(ageRaw, genderRaw);
    const { ageGroup, sexKey } = thresholds;

    // ── Upgrade 2: DPG-Integrated Onset + Age/Sex-Adaptive Movement Threshold ──
    const sleepIdx = findSleepOnset(dataset, startIdx, thresholds.ONSET_MOVE);

    // Pre-sleep HR median for hysteresis bypass reference
    const preWindow = dataset.slice(Math.max(0, sleepIdx - 60), sleepIdx);
    const hrBaseline = preWindow.length > 0
      ? [...preWindow.map(d => d.hr || 70)].sort((a,b)=>a-b)[Math.floor(preWindow.length/2)]
      : 70;
    const wakeIdx = findWakeTime(dataset, sleepIdx, hrBaseline);
    
    // ── Fix 4: Night-only graph window (onset → wake + small buffer) ──
    const graphStart = Math.max(0, sleepIdx - 30);
    const graphEnd = Math.min(dataset.length - 1, wakeIdx + 30);
    const nightDataRaw = dataset.slice(graphStart, graphEnd + 1);
    const nightDataFocus = dataset.slice(sleepIdx, wakeIdx + 1);
    const cbtReadings = nightDataRaw.map(d => ({ timestamp: d.timestamp, value: d.cbt }));

    // ── Fix 3: Dynamic Baseline (median of 30 epochs before onset) ──
    const baselineWindow = dataset.slice(Math.max(0, sleepIdx - 60), sleepIdx);
    const baselineCBTs = [...baselineWindow.map(d => d.cbt)].sort((a, b) => a - b);
    const nightBaseline = baselineCBTs.length > 0 
      ? baselineCBTs[Math.floor(baselineCBTs.length / 2)]
      : (nightDataFocus.length > 0 ? nightDataFocus[0].cbt : 36.7);

    // Track nadir (lowest CBT) for REM rise-from-nadir detection
    let nadir = nightBaseline;
    
    // ── Fix 3: Delta-based sleep staging (thesis core logic) ──
    const stages = [];
    let sleepPoints = 0;
    
    nightDataFocus.forEach((d, idx) => {
      const delta = d.cbt - nightBaseline;  // negative = cooling below baseline
      if (d.cbt < nadir) nadir = d.cbt;
      const riseFromNadir = d.cbt - nadir;
      const hoursSinceOnset = (idx * 30) / 3600; // each downsampled epoch ≈ 30s
      
      let stage = 'AWAKE';
      
      // Priority 1: AWAKE — movement exceeds twice the awake variance anchor
      if (d.move > thresholds.AWAKE_VAR * 2) {
        stage = 'AWAKE';
      }
      // Priority 2: N3 DEEP — delta below N3_LOWER AND very low movement
      else if (delta <= thresholds.N3_LOWER && d.move < thresholds.MOVE_TH * 1.5) {
        stage = 'N3';
      }
      // Priority 3: REM — after 60 min, rise from nadir >= REM_RISE, moderate move
      else if (hoursSinceOnset > 1.0 && riseFromNadir >= thresholds.REM_RISE && d.move > thresholds.MOVE_TH && d.move <= thresholds.AWAKE_VAR * 2) {
        stage = 'REM';
      }
      // Priority 4: N2 STABLE — delta below N2_LOWER AND low movement
      else if (delta <= thresholds.N2_LOWER && d.move < thresholds.MOVE_TH * 3) {
        stage = 'N2';
      }
      // Priority 5: N1 TRANSITION — any cooling, low movement
      else if (delta < 0 && d.move < thresholds.AWAKE_VAR * 2) {
        stage = 'N1';
      }

      // ── Module 7: Time-Based Corrections ──
      if (stage === 'N2' && hoursSinceOnset < 2.0 && delta <= thresholds.N3_LOWER * 0.8) {
        stage = 'N3'; // Early night N3 bias
      }
      if (stage === 'N1' && hoursSinceOnset > 5.0 && riseFromNadir >= thresholds.REM_RISE * 0.7) {
        stage = 'REM'; // Late night REM bias
      }

      // ── Upgrade 4: Hybrid Weighted Evidence Scoring for N2/REM boundary ──
      // FSM hard rules above set the stage; this soft scorer resolves ambiguous N1/N2 epochs
      // that sit near the N2-REM boundary by accumulating physiological REM evidence.
      if (stage === 'N2' || stage === 'N1') {
        let remScore = 0;
        if (hoursSinceOnset > 1.5)                          remScore += 2; // sufficient sleep pressure
        if (hoursSinceOnset > 4.0)                          remScore += 1; // late-night REM dominance
        if (riseFromNadir >= thresholds.REM_RISE * 0.5)     remScore += 2; // partial nadir rebound
        if (d.hrv > 25)                                     remScore += 1; // HRV variability = REM
        if (d.rr > 16)                                      remScore += 1; // irregular breathing
        if (d.move > thresholds.MOVE_TH * 0.8 &&
            d.move <= thresholds.AWAKE_VAR * 2)             remScore += 1; // mild atonic movement
        if (remScore >= 5) stage = 'REM'; // Soft override to REM
      }

      stages.push({ epoch_index: idx, stage, start_time: d.timestamp });

      // Scoring: max 8 points per epoch
      if (stage !== 'AWAKE') {
        let pts = 0;
        if (delta < 0) pts += 2;                          // CBT falling
        if (d.hr < 60 || d.hrv > 30) pts += 2;            // HR/HRV favorable
        if (d.rr >= 12 && d.rr <= 20) pts += 1;           // RR stable range
        if (d.move < thresholds.MOVE_TH * 2) pts += 2;    // Movement low
        if (stage === 'N3') pts += 1;                      // Deep sleep bonus
        sleepPoints += Math.min(pts, 8);
      }
    });

    // ── Fix 5: maxPts = sleepCount * 8 ──
    const sleepCount = stages.filter(s => s.stage !== 'AWAKE').length;
    const maxPts = sleepCount > 0 ? sleepCount * 8 : 1;
    const rawScore = Math.round((sleepPoints / maxPts) * 100);
    
    let qualityText = 'POOR';
    if (rawScore >= 80) qualityText = 'GOOD';
    else if (rawScore >= 60) qualityText = 'MODERATE';

    // Stage distribution
    const stageCounts = { N3: 0, N2: 0, N1: 0, REM: 0, AWAKE: 0 };
    stages.forEach(s => stageCounts[s.stage]++);
    const deepPct = sleepCount > 0 ? Math.round((stageCounts.N3 / sleepCount) * 100) : 0;
    const remPct  = sleepCount > 0 ? Math.round((stageCounts.REM / sleepCount) * 100) : 0;

    // ── Upgrade 5: Non-Linear Sigmoid HR→CBT Strain Model (Report §6.1) ──
    // Epstein-Roberts: HR = 41 + 152·(1 + 0.06·e^{-0.89·(CBT-37.84)})^{1/0.07}
    // Inverted to predict CBT from HR; strainDev = measured - predicted
    // Age offset: YOUNG=0, MID=-0.05, OLDER/ELDERLY=-0.10/-0.15
    const AGE_CBT_OFFSET = { CHILD: 0.10, TEEN: 0.05, YOUNG: 0.0, MID: -0.05, OLDER: -0.10, ELDERLY: -0.15 };
    const cbtOffset = AGE_CBT_OFFSET[ageGroup] || 0;

    const predictedCBTFromHR = (hr) => {
      try {
        const hrAdj = Math.max(hr - 41, 0.5) / 152;
        const inner = Math.pow(hrAdj, 0.07) - 1;
        if (inner <= 0) return null;
        const logVal = Math.log(inner / 0.06);
        return (37.84 - logVal / 0.89) + cbtOffset;
      } catch { return null; }
    };

    const strainDevs = nightDataFocus
      .map(d => { const p = predictedCBTFromHR(d.hr || 70); return p !== null ? d.cbt - p : null; })
      .filter(v => v !== null);
    const sortedDevs = [...strainDevs].sort((a,b) => a-b);
    const medianStrainDev = sortedDevs.length > 0
      ? sortedDevs[Math.floor(sortedDevs.length / 2)] : 0;

    let hydrationStatus = 'LOW_RISK';
    if (medianStrainDev >= 0.15)      hydrationStatus = 'HIGH_RISK';
    else if (medianStrainDev >= 0.05) hydrationStatus = 'MILD_RISK';

    // Dynamic explanation with sex/age context
    let explanationText = '';
    const sug = [];

    if (rawScore >= 80) {
      explanationText = `Excellent sleep. CBT dropped ${Math.abs(nadir - nightBaseline).toFixed(2)}°C below ${ageGroup}-${sexKey} dynamic baseline of ${nightBaseline.toFixed(2)}°C. Deep: ${deepPct}%, REM: ${remPct}%.`;
      sug.push('Maintain current biological rhythms for optimal thermoregulation.');
    } else if (rawScore >= 60) {
      explanationText = `Moderate sleep. ${ageGroup}-${sexKey} baseline (${nightBaseline.toFixed(2)}°C) showed partial cooling. Deep: ${deepPct}%, REM: ${remPct}%.`;
      sug.push('Consider cooling the body or limiting late activities to improve next cycle.');
    } else {
      explanationText = `Poor architecture. Insufficient CBT drop below ${ageGroup}-${sexKey} baseline of ${nightBaseline.toFixed(2)}°C. Deep sleep only ${deepPct}%.`;
      sug.push('Immediate intervention: ensure adequate hydration and physical rest before bed.');
    }

    if (hydrationStatus !== 'LOW_RISK') {
      sug.push(`Hydration strain detected (σ=+${medianStrainDev.toFixed(3)}°C above HR-predicted CBT). Drink more fluids before sleep.`);
    }

    const parsedData = {
      sleep_score: Math.min((rawScore / 100) * 8, 8).toFixed(1),
      sleep_quality: qualityText,
      hydration_status: hydrationStatus,
      wake_time: dataset[wakeIdx].timestamp,
      sleep_stages: stages,
      cbt_readings: cbtReadings,
      explanation: explanationText,
      suggestions: sug
    };

    setTimeout(() => {
      setData(parsedData);
      setCurrentIndex(wakeIdx);
      setIsUploading(false);
      setPatchStatus('Report generated. Awaiting next night...');
      
      // ── Fix 7: Auto-reset for next day cycle (thesis: Daily Reset) ──
      setTerminalLogs(prev => [...prev, '[SYSTEM] ✅ Final report submitted. Session reset for next physiological night.']);
      setLiveMetrics({ hr: '--', rr: '--', hrv: '--' });
    }, 800);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPatchStatus('Patch Syncing...');
      setIsUploading(true);
      setData(null);
      setFullDataset(null);
      setCurrentIndex(0);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n');
        if (lines.length < 2) {
          setIsUploading(false);
          return;
        }

        const rawDataset = [];
        // Downsample roughly to 30-sec windows
        for (let i = 1; i < lines.length; i += 30) {
          const cols = lines[i].split(',');
          if (cols.length >= 6) {
            const time = cols[0].trim();
            const cbt = parseFloat(cols[1]); // cbt
            const hrv = parseFloat(cols[2]); // HRV
            const rr = parseFloat(cols[3]); // Respiration Rate
            const skin = parseFloat(cols[4]);
            const move = parseFloat(cols[5]);
            // CSV column format (dataset files): timestamp, cbt, HRV, rr, skin_temp, movement, heart_rate
            // Columns:                                   [0]    [1]  [2]  [3]    [4]       [5]         [6]
            // Note: col[6] is heart_rate in the sample CSVs. Falls back to motion-estimated HR if absent.
            const hr = cols.length > 6 && !isNaN(parseFloat(cols[6]))
              ? parseFloat(cols[6])
              : Math.round(55 + (move * 15)); // estimated HR from movement if column absent

            if (!isNaN(cbt)) {
               rawDataset.push({ timestamp: time, cbt, hr, rr, skin, move, hrv });
            }
          }
        }
        
        setFullDataset(rawDataset);
        // Automatically process the physiological "Night 1" with Master Profile
        processNight(rawDataset, 0, profile);
        
        // Unleash the Live Tracker Visualizer!
        startBiometricStream(rawDataset);
      };
      
      reader.readAsText(file);
    }
  };

  if (!data && !isUploading) {
    return (
      <div className="layout-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
         <Activity size={48} className="text-gradient" style={{ animation: 'pulse 2s infinite' }} />
         <h2 style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>Connecting to Smart Patch...</h2>
      </div>
    );
  }

  const activeData = data || mockDataTemplate;

  return (
    <div className="layout-container" style={{ paddingBottom: '4rem' }}>
      
      {/* Header with Upload Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>Dashboard.</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Wearable patch biometric diagnostic feed.</p>
        </div>
        
        {/* Patch Sync Bar & Next Night Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* NEXT NIGHT ACTION BUTTON */}
            {fullDataset && currentIndex < fullDataset.length - WINDOW * 2 && (
              <button 
                className="btn-primary" 
                onClick={() => processNight(fullDataset, currentIndex, profile)} 
                style={{ height: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 0 15px rgba(0,242,254,0.3)' }}
              >
                <FastForward size={18} /> Analyze Next Night
              </button>
            )}

            <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Activity size={16} color="var(--accent-purple)" />
              <span style={{ fontSize: '0.9rem', color: patchStatus !== 'Patch disconnected' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {isUploading ? 'Streaming Patch Data...' : patchStatus}
              </span>
              <button 
                className="btn-primary" 
                style={{ width: 'auto', padding: '6px 12px', borderRadius: '14px', fontSize: '0.85rem', marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Activity size={14} /> Sync Patch
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".csv,.json"
                onChange={handleFileUpload} 
              />
            </div>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <Clock size={14} /> Circadian Wake Sync: {new Date(activeData.wake_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </header>

      {/* Main Grid: Left sidebar (Profile) vs Main Content (Stats & Curve) */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: '2rem' }}>
        
        {/* LEFT COLUMN: Profile and Terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <ProfileCard profile={profile} setProfile={setProfile} />
          
          {/* Continuous Real-time Biometric Metric Bars (HRV & RR) */}
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            {/* HRV Box */}
            <GlassCard style={{ flex: 1, padding: '12px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5, 10, 20, 0.5)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '1px' }}>HRV</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#10b981' }}>{liveMetrics.hrv}</div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>ms</span>
              </div>
            </GlassCard>
            
            {/* Respiration Box */}
            <GlassCard style={{ flex: 1, padding: '12px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5, 10, 20, 0.5)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '1px' }}>RESP</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#00f2fe' }}>{liveMetrics.rr}</div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>bpm</span>
              </div>
            </GlassCard>
          </div>

          {/* Terminal Block in Left Sidebar */}
          <GlassCard style={{ background: '#0a0a0a', border: '1px solid #333', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
              <span style={{ color: '#00f2fe', fontFamily: 'monospace', fontSize: '0.85rem' }}>$ watch_biometric_feed -v</span>
              {isStreaming ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  <Activity size={12} style={{ animation: 'pulse 1s infinite' }} /> STREAMING
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>IDLE</span>
              )}
            </div>
            <div 
              ref={terminalContainerRef}
              style={{ 
                height: '320px', 
                overflowY: 'auto', 
                fontFamily: '"Fira Code", "Courier New", monospace', 
                fontSize: '0.8rem', 
                color: '#10b981',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {terminalLogs.map((log, i) => (
                <div key={i} style={{ 
                  opacity: i === terminalLogs.length - 1 ? 1 : 0.7, 
                  color: log.includes('[!!!]') ? '#ef4444' : '#10b981',
                  lineHeight: '1.2'
                }}>{log}</div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* RIGHT COLUMN: Analytical Scores, Hydration, Expanded CBT Graph */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Top Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
            {/* Score Hero */}
            <GlassCard style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <h3 style={{ color: 'var(--text-secondary)', margin: 0 }}>Sleep Score</h3>
                 <div className={`status-badge status-${activeData.sleep_quality}`}>
                   {activeData.sleep_quality}
                 </div>
              </div>
              <CircularProgress score={activeData.sleep_score} max={8} label="Quality Points" />
              <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#e2e8f0', fontStyle: 'italic' }}>
                "{activeData.explanation}"
              </div>
            </GlassCard>

            {/* Hydration Status & Suggestions */}
            <GlassCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
                 <div style={{ padding: '12px', background: 'rgba(236, 201, 75, 0.1)', borderRadius: '12px' }}>
                   <Droplet size={32} color="var(--accent-warning)" />
                 </div>
                 <div>
                   <h3>Hydration Status</h3>
                   <div className={`status-badge status-${activeData.hydration_status}`} style={{ marginTop: '8px' }}>
                     {activeData.hydration_status.replace('_', ' ')}
                   </div>
                 </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-warning)' }}>
                  <AlertTriangle size={18} /> Optimization
                </h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {activeData.suggestions.map((sug, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                      <CheckCircle size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontSize: '0.9rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>{sug}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </GlassCard>
          </div>

          {/* Bottom Row: Full Width Expanded CBT Curve */}
          <div style={{ flexGrow: 1, minHeight: '350px' }}>
            <CBTGraph cbtReadings={activeData.cbt_readings} />
          </div>

        </div>
      </div>

      {isUploading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(6, 11, 25, 0.8)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <Activity size={48} className="text-gradient" style={{ animation: 'pulse 1.5s infinite', marginBottom: '20px' }} />
          <h2 style={{ color: 'white' }}>Establishing Patch Connection...</h2>
          <p style={{ color: 'var(--accent-cyan)', marginTop: '10px' }}>Streamlining biometrics locally.</p>
        </div>
      )}

      {/* Real-time Hydration Alert Popup */}
      <HydrationAlertPopup 
        alert={hydrationAlert} 
        onClose={() => setHydrationAlert(null)} 
      />
    </div>
  );
};

export default Dashboard;
