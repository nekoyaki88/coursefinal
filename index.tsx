import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

const SESSIONS = [
  { warmup: 180, cooldown: 180, intervals: { run: 10, walk: 50, reps: 15 } },
  { warmup: 180, cooldown: 180, intervals: { run: 20, walk: 40, reps: 15 } },
  { warmup: 180, cooldown: 180, intervals: { run: 30, walk: 30, reps: 15 } },
  { warmup: 180, cooldown: 180, intervals: { run: 30, walk: 30, reps: 20 } },
  { warmup: 180, cooldown: 180, intervals: { run: 40, walk: 20, reps: 15 } },
  { warmup: 180, cooldown: 180, intervals: { run: 40, walk: 20, reps: 20 } },
  { warmup: 180, cooldown: 180, intervals: { run: 60, walk: 30, reps: 10 } },
  { warmup: 180, cooldown: 180, intervals: { run: 60, walk: 30, reps: 12 } },
  { warmup: 180, cooldown: 180, intervals: { run: 120, walk: 60, reps: 5 } },
  { warmup: 180, cooldown: 180, intervals: { run: 180, walk: 60, reps: 4 } },
  { warmup: 180, cooldown: 180, intervals: { run: 240, walk: 60, reps: 4 } },
  { warmup: 180, cooldown: 180, intervals: { run: 360, walk: 60, reps: 3 } },
  { warmup: 180, cooldown: 180, intervals: { run: 480, walk: 60, reps: 2 } },
  { warmup: 180, cooldown: 180, intervals: { run: 600, walk: 60, reps: 2 } },
  { warmup: 180, cooldown: 180, intervals: { run: 900, walk: 0, reps: 1 } },
  { warmup: 180, cooldown: 180, intervals: { run: 1200, walk: 0, reps: 1 } },
];

const PHASE_DETAILS = {
  warmup: { label: 'Échauffement', color: 'var(--warmup-color)' },
  run: { label: 'Course', color: 'var(--run-color)' },
  walk: { label: 'Marche', color: 'var(--walk-color)' },
  cooldown: { label: 'Récupération', color: 'var(--cooldown-color)' },
  finished: { label: 'Terminé', color: 'var(--primary-color)' },
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const speak = (text) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  }
};

const SessionPlayer = ({ session, onBack }) => {
  const [phase, setPhase] = useState('warmup');
  const [rep, setRep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(session.warmup);
  const [totalTime, setTotalTime] = useState(session.warmup);
  const [isActive, setIsActive] = useState(false);
  const [bpm, setBpm] = useState(170);

  const timerRef = useRef(null);
  const metronomeRef = useRef(null);
  const audioContextRef = useRef(null);

  const resetState = useCallback(() => {
    setIsActive(false);
    setPhase('warmup');
    setRep(0);
    setTimeLeft(session.warmup);
    setTotalTime(session.warmup);
    if (timerRef.current) clearInterval(timerRef.current);
    if (metronomeRef.current) clearInterval(metronomeRef.current);
  }, [session]);

  useEffect(() => {
    return () => { // Cleanup on unmount
        if (timerRef.current) clearInterval(timerRef.current);
        if (metronomeRef.current) clearInterval(metronomeRef.current);
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
    };
  }, []);

  const startNextPhase = useCallback(() => {
    if (phase === 'warmup') {
      setPhase('run');
      setRep(1);
      setTimeLeft(session.intervals.run);
      setTotalTime(session.intervals.run);
    } else if (phase === 'run') {
      if (session.intervals.walk > 0) {
        setPhase('walk');
        setTimeLeft(session.intervals.walk);
        setTotalTime(session.intervals.walk);
        speak('Marchez');
      } else if (rep < session.intervals.reps) { // For run-only intervals
        setRep(prev => prev + 1);
        setTimeLeft(session.intervals.run);
        setTotalTime(session.intervals.run);
      } else {
        setPhase('cooldown');
        setTimeLeft(session.cooldown);
        setTotalTime(session.cooldown);
      }
    } else if (phase === 'walk') {
      if (rep < session.intervals.reps) {
        setPhase('run');
        setRep(prev => prev + 1);
        setTimeLeft(session.intervals.run);
        setTotalTime(session.intervals.run);
      } else {
        setPhase('cooldown');
        setTimeLeft(session.cooldown);
        setTotalTime(session.cooldown);
      }
    } else if (phase === 'cooldown') {
      setPhase('finished');
      setIsActive(false);
    }
  }, [phase, rep, session]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            startNextPhase();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, startNextPhase]);

  const playTick = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'suspended') return;
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
    gainNode.gain.setValueAtTime(1, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.05);
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + 0.05);
  }, []);

  useEffect(() => {
    if (isActive && phase === 'run') {
      metronomeRef.current = setInterval(playTick, 60000 / bpm);
    } else {
      if (metronomeRef.current) clearInterval(metronomeRef.current);
    }
    return () => clearInterval(metronomeRef.current);
  }, [isActive, phase, bpm, playTick]);

  const toggleTimer = () => {
    if (!audioContextRef.current) {
        // Fix: Property 'webkitAudioContext' does not exist on type 'Window & typeof globalThis'. Cast to 'any' for older browser compatibility.
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
    if (phase === 'finished') {
        resetState();
    } else {
        setIsActive(!isActive);
    }
  };

  const circumference = 2 * Math.PI * 90;
  const offset = circumference - (timeLeft / totalTime) * circumference;

  return (
    <div className="player-container">
      <div className="player-header">
        <button onClick={onBack} className="back-button">← Retour</button>
        <h2>Séance {SESSIONS.indexOf(session) + 1}</h2>
      </div>
      
      <div className="timer-display">
        <svg className="timer-svg" width="220" height="220" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="#e6e6e6" strokeWidth="10" />
          <circle
            className="timer-circle"
            cx="100" cy="100" r="90" fill="none"
            stroke={PHASE_DETAILS[phase]?.color || 'var(--primary-color)'}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={isNaN(offset) ? 0 : offset}
          />
        </svg>
        <div className="timer-text-content">
          <div className="phase-text">{PHASE_DETAILS[phase]?.label}</div>
          <div className="time-left">{formatTime(timeLeft)}</div>
          {['run', 'walk'].includes(phase) && (
            <div className="repetition-text">
              Répétition: {rep} / {session.intervals.reps}
            </div>
          )}
        </div>
      </div>
      
      <div className="metronome-container" disabled={phase !== 'run'}>
        <label htmlFor="bpm-slider">MÉTRONOME: {bpm} PPM</label>
        <input
          type="range"
          id="bpm-slider"
          className="metronome-slider"
          min="165"
          max="180"
          step="1"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          disabled={phase !== 'run'}
        />
      </div>

      <div className="controls">
        <button onClick={toggleTimer} className="control-button start-pause-button">
          {phase === 'finished' ? 'RECOMMENCER' : isActive ? 'PAUSE' : 'DÉMARRER'}
        </button>
        <button onClick={resetState} className="control-button reset-button">RÉINITIALISER</button>
      </div>
    </div>
  );
};

const SessionList = ({ onSelect }) => (
  <div className="session-grid">
    {SESSIONS.map((session, index) => (
      <div key={index} className="session-card" onClick={() => onSelect(index)}>
        <h2>Séance {index + 1}</h2>
        <p>
          {session.intervals.run >= 60 ? `${session.intervals.run / 60}'` : `${session.intervals.run}"`} Course
          {session.intervals.walk > 0 && ` / ${session.intervals.walk >= 60 ? `${session.intervals.walk / 60}'` : `${session.intervals.walk}"`} Marche`}
          <br />
          {session.intervals.reps} fois
        </p>
      </div>
    ))}
  </div>
);

const App = () => {
  const [selectedSession, setSelectedSession] = useState(null);

  const handleSelectSession = (index) => {
    setSelectedSession(index);
  };

  const handleBack = () => {
    setSelectedSession(null);
  };

  return (
    <div className="app-container">
      <h1>Programme de Course</h1>
      {selectedSession === null ? (
        <SessionList onSelect={handleSelectSession} />
      ) : (
        <SessionPlayer session={SESSIONS[selectedSession]} onBack={handleBack} />
      )}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
