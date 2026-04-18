/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lightbulb, 
  Fan, 
  Tv, 
  Car, 
  Lamp, 
  Sun, 
  RotateCcw, 
  Star, 
  Sparkles,
  Volume2,
  Gamepad2,
  Moon,
  Home,
  Bot,
  Music,
  Trophy,
  PartyPopper,
  Ghost,
  ChevronLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GoogleGenAI } from "@google/genai";

// --- Types & Constants ---

type Mode = 'menu' | 'board' | 'follow-me' | 'puzzle' | 'dark-room' | 'music-dj' | 'stickers' | 'abc';

interface Device {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  hindiName: string;
  note?: number;
}

const DEVICES: Device[] = [
  { id: 'bulb', name: 'Magic Bulb', icon: Lightbulb, color: 'toy-yellow-gradient', hindiName: 'Bulb', note: 261.63 },
  { id: 'fan', name: 'Windy Fan', icon: Fan, color: 'toy-blue-gradient', hindiName: 'Pankha', note: 293.66 },
  { id: 'radio', name: 'Music Box', icon: Music, color: 'toy-pink-gradient', hindiName: 'Radio', note: 329.63 },
  { id: 'tv', name: 'TV Star', icon: Tv, color: 'toy-purple-gradient', hindiName: 'TV', note: 349.23 },
  { id: 'car', name: 'Zoom Car', icon: Car, color: 'toy-orange-gradient', hindiName: 'Gaadi', note: 392.00 },
  { id: 'sun', name: 'Golden Sun', icon: Sun, color: 'toy-yellow-gradient', hindiName: 'Suraj', note: 440.00 },
];

const COLORS = {
  primary: '#fcd34d', // Amber 300
  secondary: '#60a5fa', // Blue 400
  success: '#4ade80', // Green 400
  danger: '#f87171', // Red 400
  purple: '#a78bfa', // Purple 400
};

// --- Audio Engine ---
// Persistent Audio Context to prevent "Music not working" in many browsers
let globalAudioCtx: AudioContext | null = null;

const playSound = (type: 'toggle' | 'success' | 'click' | 'wrong' | 'note' | 'abc', value?: string | number) => {
  if (!globalAudioCtx) {
    globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }

  const ctx = globalAudioCtx;
  const now = ctx.currentTime;

  const createGain = (val: number, duration: number) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(val, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    return gain;
  };

  if (type === 'toggle') {
    const osc = ctx.createOscillator();
    const gain = createGain(0.2, 0.2);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(value === 'on' ? 600 : 300, now);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.2);
  }

  if (type === 'note') {
    const freq = typeof value === 'number' ? value : parseFloat(value as string) || 440;
    const osc = ctx.createOscillator();
    const gain = createGain(0.3, 0.5);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.5);
  }

  if (type === 'success') {
    [440, 554, 659, 880].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = createGain(0.1, 0.4);
      osc.frequency.setValueAtTime(f, now + i * 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.4);
    });
  }

  if (type === 'click' || type === 'wrong') {
     const osc = ctx.createOscillator();
     const gain = createGain(0.2, type === 'click' ? 0.1 : 0.3);
     osc.frequency.setValueAtTime(type === 'click' ? 800 : 150, now);
     if (type === 'wrong') osc.frequency.linearRampToValueAtTime(50, now + 0.3);
     osc.connect(gain).connect(ctx.destination);
     osc.start();
     osc.stop(now + (type === 'click' ? 0.1 : 0.3));
  }

  if (type === 'abc') {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const freqMap: Record<string, number> = {};
    letters.split("").forEach((l, i) => {
      freqMap[l] = 261.63 * Math.pow(1.05946, i); // Chromatic scale starting from C4
    });
    
    const freq = freqMap[value as string] || 440;
    const osc = ctx.createOscillator();
    const gain = createGain(0.3, 0.4);
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.4);
    
    // Voice fallback
    const utterance = new SpeechSynthesisUtterance(value as string);
    utterance.pitch = 1.8;
    utterance.rate = 1.2;
    window.speechSynthesis.speak(utterance);
  }
};

// --- Gemini AI Hook ---

const useGeminiHint = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ai = useMemo(() => {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') return null;
    return new GoogleGenAI({ apiKey: key });
  }, []);

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.5;
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const getHint = async (mode: Mode, state: any) => {
    // Local offline hints
    const getLocalHint = () => {
      if (mode === 'follow-me') {
        const { target, targetOn } = state;
        return `Click the ${target?.name} switch to turn it ${targetOn ? 'on' : 'off'}!`;
      }
      return "Keep playing! You are doing great!";
    };

    if (!ai) {
      speak(getLocalHint());
      return;
    }

    try {
      const promptText = `You are a friendly robot for kids aged 3-5. 
      The kid is playing a switchboard app in mode: ${mode}. 
      State: ${JSON.stringify(state)}.
      Give a very short (max 10 words), encouraging hint in super simple English.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: promptText
      });
      
      const hintText = result.text || getLocalHint();
      speak(hintText);
    } catch (error) {
      speak(getLocalHint());
    }
  };

  return { getHint, isSpeaking };
};

// --- Components ---

interface SwitchProps {
  on: boolean;
  onClick: () => void;
  color: string;
  label: string;
  icon: React.ElementType;
  id: string;
}

const Switch: React.FC<SwitchProps> = ({ on, onClick, color, label, icon: Icon, id }) => {
  return (
    <div 
      onClick={() => {
        playSound('toggle', on ? 'off' : 'on');
        onClick();
      }}
      className={`toy-card p-4 sm:p-6 cursor-pointer flex flex-col items-center justify-center gap-3 sm:gap-4 h-full relative overflow-hidden transition-all duration-300 ${on ? color : 'bg-white'}`}
    >
      {/* Real Animation Overlays */}
      <AnimatePresence>
        {on && (id === 'bulb' || id === 'lamp' || id === 'sun') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.5 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/30 blur-[40px] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <motion.div 
        animate={on ? (
          id === 'fan' ? { rotate: 360 } : 
          id === 'car' ? { x: [0, -2, 2, 0], y: [0, 1, -1, 0] } :
          id === 'tv' ? { opacity: [1, 0.8, 1, 0.9, 1] } : {}
        ) : { rotate: 0 }}
        transition={on ? (
          id === 'fan' ? { repeat: Infinity, duration: 0.4, ease: "linear" } :
          id === 'car' ? { repeat: Infinity, duration: 0.1 } :
          id === 'tv' ? { repeat: Infinity, duration: 0.2 } : { type: 'spring' }
        ) : { type: 'spring' }}
        className={`p-3 sm:p-4 rounded-full z-10 ${on ? 'bg-white/40' : 'bg-slate-100'}`}
      >
        <Icon size={48} className={`sm:w-16 sm:h-16 ${on ? 'text-white' : 'text-slate-400'}`} />
      </motion.div>
      
      <div className={`w-20 sm:w-28 h-10 sm:h-14 rounded-full relative border-[3px] sm:border-[4px] border-[--color-bento-ink] overflow-hidden z-10 ${on ? 'bg-[--color-bento-green]' : 'bg-slate-200'}`}>
        <motion.div 
          animate={{ left: on ? 'calc(100% - 32px)' : '3px' }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="absolute top-1 w-6 h-6 sm:w-10 sm:h-10 bg-white rounded-full border-[3px] sm:border-[4px] border-[--color-bento-ink]"
        />
      </div>
      
      <span className="text-sm sm:text-xl font-black uppercase tracking-tight text-[--color-bento-ink] text-center z-10">{label}</span>
      
      {/* Background Action Visuals */}
      {on && id === 'sun' && (
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
          className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"
        />
      )}
    </div>
  );
};

const Header = ({ title, onBack, rightContent }: { title: string; onBack: () => void, rightContent?: React.ReactNode }) => (
  <div className="p-4 sm:p-6 flex items-center justify-between w-full max-w-6xl relative z-50">
    <div className="flex items-center gap-3 sm:gap-6 shrink-0">
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          playSound('click');
          onBack();
        }}
        className="toy-card p-3 sm:p-4 bg-white"
      >
        <ChevronLeft size={32} className="sm:w-10 sm:h-10 text-[--color-toy-ink]" />
      </motion.button>
      <div className="toy-card bg-white px-6 sm:px-10 py-2 sm:py-3 !rounded-full">
        <h1 className="text-xl sm:text-4xl font-black text-[--color-toy-ink] uppercase whitespace-nowrap">🏠 {title}</h1>
      </div>
    </div>
    <div className="hidden sm:block shrink">
      {rightContent || <div className="toy-card bg-white px-4 py-2 text-2xl">🧒</div>}
    </div>
  </div>
);

// --- Views ---

const Menu = ({ setMode, stickerCount }: { setMode: (m: Mode) => void, stickerCount: number }) => {
  const menuItems = [
    { mode: 'board' as Mode, label: 'Free Play', icon: Lightbulb, color: 'toy-yellow-gradient', desc: 'Touch!', span: 'sm:col-span-2' },
    { mode: 'follow-me' as Mode, label: 'Game Mode', icon: Gamepad2, color: 'toy-blue-gradient', desc: 'Play!', span: 'sm:row-span-2' },
    { mode: 'abc' as Mode, label: 'ABC Fun', icon: Bot, color: 'toy-green-gradient', desc: 'Learn ABC!', span: 'sm:col-span-1' },
    { mode: 'music-dj' as Mode, label: 'Music DJ', icon: Music, color: 'toy-pink-gradient', desc: 'DJ!', span: 'sm:col-span-1' },
    { mode: 'puzzle' as Mode, label: 'Solve All', icon: Sparkles, color: 'toy-orange-gradient', desc: 'Fun!', span: 'sm:col-span-1' },
    { mode: 'dark-room' as Mode, label: 'Bedtime', icon: Moon, color: 'toy-green-gradient', desc: 'Lights!', span: 'sm:col-span-2' },
    { mode: 'stickers' as Mode, label: 'Rewards', icon: Trophy, color: 'toy-purple-gradient', desc: `${stickerCount} Won!`, span: 'sm:col-span-1' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 sm:p-10 w-full max-w-6xl h-full pb-32 overflow-y-auto relative z-20">
      {menuItems.map((item, i) => (
        <motion.div
          key={item.mode}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          whileHover={{ scale: 1.05, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            playSound('click');
            setMode(item.mode);
          }}
          className={`toy-card ${item.span} ${item.color} p-4 sm:p-8 cursor-pointer flex flex-col items-center justify-center gap-4 text-center group min-h-[160px]`}
        >
          <div className="bg-white/30 backdrop-blur-sm p-4 sm:p-6 rounded-[2rem] sm:rounded-[3rem] border-[3px] border-white/50 group-hover:scale-110 transition-transform">
            <item.icon size={48} className="sm:w-20 sm:h-20 text-white drop-shadow-lg" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-4xl font-black uppercase text-white leading-none drop-shadow-md">{item.label}</span>
            <span className="text-xs sm:text-lg font-bold text-white/80 uppercase">{item.desc}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const Board = ({ onBack }: { onBack: () => void }) => {
  const [states, setStates] = useState<Record<string, boolean>>({});
  const onCount = Object.values(states).filter(Boolean).length;

  return (
    <div className="flex flex-col items-center w-full h-full overflow-y-auto pb-24">
      <Header 
        title="Play Board" 
        onBack={onBack} 
        rightContent={<div className="text-xl sm:text-2xl font-black text-[--color-bento-pink] uppercase">{onCount} ON! 🌟</div>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 sm:p-10 w-full max-w-6xl">
        {DEVICES.map((d, i) => (
          <div key={d.id} className={i % 3 === 0 ? 'sm:col-span-2' : ''}>
            <Switch 
              id={d.id}
              on={!!states[d.id]}
              onClick={() => setStates(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
              color={d.color}
              label={d.name}
              icon={d.icon}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const FollowMe = ({ onBack, addSticker }: { onBack: () => void, addSticker: (s: string) => void }) => {
  const [target, setTarget] = useState<Device | null>(null);
  const [targetOn, setTargetOn] = useState(true);
  const [states, setStates] = useState<Record<string, boolean>>({});
  const [score, setScore] = useState(0);
  const { getHint, isSpeaking } = useGeminiHint();

  const pickNewTarget = useCallback(() => {
    const next = DEVICES[Math.floor(Math.random() * DEVICES.length)];
    setTarget(next);
    setTargetOn(Math.random() > 0.5);
  }, []);

  useEffect(() => {
    pickNewTarget();
  }, [pickNewTarget]);

  const handleToggle = (id: string) => {
    const newState = !states[id];
    setStates(prev => ({ ...prev, [id]: newState }));

    if (target && id === target.id && newState === targetOn) {
      playSound('success');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, colors: ['#fbbf24', '#60a5fa', '#4ade80'] });
      
      const newScore = score + 1;
      setScore(newScore);

      // Reward every 3 points
      if (newScore % 3 === 0) {
        const stickers = ["🦁", "🐘", "🦕", "🍕", "🍦", "🚀", "🛸", "🤖", "🌈"];
        const winSticker = stickers[Math.floor(Math.random() * stickers.length)];
        addSticker(winSticker);
      }

      setTimeout(pickNewTarget, 1000);
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-full pb-24 overflow-y-auto">
      <Header title="Follow Me" onBack={onBack} />
      
      <div className="bento-grid-layout p-4 sm:p-8 w-full max-w-6xl h-full">
        {/* Helper Character Card */}
        <div className="col-span-2 sm:row-span-2 toy-card toy-blue-gradient text-white p-6 sm:p-10 flex flex-col items-center justify-center gap-6 min-h-[250px]">
          <div className="relative w-full">
            <div className="bg-white px-6 py-4 rounded-[2rem] border-[4px] border-[--color-toy-ink] text-[--color-toy-ink] text-xl sm:text-3xl font-black uppercase text-center mb-8 relative shadow-xl after:content-[''] after:absolute after:bottom-[-24px] after:left-1/2 after:ml-[-12px] after:border-[12px] after:border-t-[--color-toy-ink] after:border-x-transparent after:border-b-transparent">
              Turn the <b>{target?.name}</b> {targetOn ? 'ON' : 'OFF'}!
            </div>
          </div>
          <motion.div
            animate={isSpeaking ? { 
              scale: [1, 1.15, 1], 
              rotate: [-5, 5, -5],
              y: [0, -10, 0]
            } : { y: [0, -5, 0] }}
            transition={isSpeaking ? { repeat: Infinity, duration: 0.4 } : { repeat: Infinity, duration: 2 }}
            className="text-8xl sm:text-[140px] leading-none drop-shadow-2xl"
          >
            🦊
          </motion.div>
          <div className="flex gap-3 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={32} className={`sm:w-12 sm:h-12 drop-shadow-md ${i < score % 5 ? 'text-yellow-300 fill-yellow-300' : 'text-white/20'}`} />
            ))}
          </div>
        </div>

        {/* Device Switches */}
        {DEVICES.map((d) => (
          <Switch 
            key={d.id}
            id={d.id}
            on={!!states[d.id]}
            onClick={() => handleToggle(d.id)}
            color={d.color}
            label={d.name}
            icon={d.icon}
          />
        ))}

        {/* AI Hint Button */}
        <button 
          onClick={() => getHint('follow-me', { target, targetOn, states })}
          disabled={isSpeaking}
          className="bento-card col-span-2 bg-[--color-bento-pink] p-4 sm:p-6 flex items-center justify-center gap-3 sm:gap-4 group min-h-[80px]"
        >
          <div className="bg-white p-2 sm:p-3 rounded-full border-[2px] sm:border-[3px] border-[--color-bento-ink]">
             <Volume2 size={24} className="sm:w-8 sm:h-8 text-[--color-bento-ink]" />
          </div>
          <span className="text-xl sm:text-3xl font-black uppercase text-white tracking-wider sm:tracking-widest">Robot Hint!</span>
        </button>
      </div>
    </div>
  );
};

const Puzzle = ({ onBack }: { onBack: () => void }) => {
  const [states, setStates] = useState<Record<string, boolean>>({});
  const [isAllOn, setIsAllOn] = useState(false);

  useEffect(() => {
    const allOn = DEVICES.every(d => states[d.id]);
    if (allOn && !isAllOn) {
      setIsAllOn(true);
      playSound('success');
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
    }
  }, [states, isAllOn]);

  return (
    <div className="flex flex-col items-center w-full h-full pb-24 overflow-y-auto">
      <Header title="Puzzle Mode" onBack={onBack} />
      
      <div className="mb-4 sm:mb-8 text-center px-4">
        <h2 className="text-3xl sm:text-5xl font-black text-[--color-bento-ink] uppercase animate-pulse">
          {isAllOn ? "YOU ARE A STAR! 🎉" : "Turn them all ON!"}
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 sm:p-10 w-full max-w-6xl">
        {DEVICES.map((d, i) => (
          <div key={d.id} className={i === 2 || i === 5 ? 'sm:row-span-2' : ''}>
            <Switch 
              id={d.id}
              on={!!states[d.id]}
              onClick={() => {
                if (isAllOn) return;
                setStates(prev => ({ ...prev, [d.id]: !prev[d.id] }));
              }}
              color={d.color}
              label={d.name}
              icon={d.icon}
            />
          </div>
        ))}
      </div>

      {isAllOn && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => {
            playSound('click');
            setStates({});
            setIsAllOn(false);
          }}
          className="mt-8 sm:mt-12 px-8 sm:px-12 py-4 sm:py-6 bento-card bg-[--color-bento-yellow] flex items-center gap-4 !rounded-full"
        >
          <RotateCcw size={32} className="sm:w-12 sm:h-12" />
          <span className="text-2xl sm:text-4xl font-black uppercase whitespace-nowrap">Start Over</span>
        </motion.button>
      )}
    </div>
  );
};

const DarkRoom = ({ onBack }: { onBack: () => void }) => {
  const [states, setStates] = useState<Record<string, boolean>>({});
  const onCount = Object.values(states).filter(Boolean).length;
  const isBright = onCount > 2;

  return (
    <div className={`flex flex-col items-center w-full h-full transition-colors duration-1000 overflow-y-auto pb-24 ${isBright ? 'bg-[--color-bento-bg]' : 'bg-[#121212]'}`}>
      <Header 
        title="Dark Room" 
        onBack={onBack} 
        rightContent={
          <div className={`px-4 py-2 rounded-full border-[3px] border-[--color-bento-ink] font-black uppercase ${isBright ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}>
            {isBright ? 'Bright Day! ☀️' : 'Sleepy Night... 🌙'}
          </div>
        }
      />
      
      <div className="flex-1 w-full max-w-6xl p-4 sm:p-8 flex flex-col items-center">
        {/* Main Light Fixture Visual */}
        <motion.div
           animate={onCount > 0 ? { 
             scale: [1, 1.02, 1],
             boxShadow: isBright 
               ? ["0 0 20px rgba(0,0,0,0.1)", "0 0 100px rgba(255,217,61,0.4)", "0 0 20px rgba(0,0,0,0.1)"]
               : ["0 0 0px rgba(0,0,0,0)", "0 0 40px rgba(255,217,61,0.2)", "0 0 0px rgba(0,0,0,0)"]
           } : { scale: 1 }}
           transition={{ repeat: Infinity, duration: 2 }}
           className={`mb-8 sm:mb-12 p-10 sm:p-14 rounded-full border-[6px] sm:border-[8px] border-[--color-bento-ink] transition-all duration-500 ${onCount > 0 ? 'bg-[--color-bento-yellow]' : 'bg-slate-700'}`}
        >
          {onCount > 0 ? <Sun size={80} className="sm:w-32 sm:h-32 text-white" /> : <Moon size={80} className="sm:w-32 sm:h-32 text-slate-400" />}
        </motion.div>

        <div className="bento-grid-layout w-full">
          {DEVICES.map((d) => (
            <Switch 
              key={d.id}
              id={d.id}
              on={!!states[d.id]}
              onClick={() => setStates(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
              color={d.color}
              label={d.name}
              icon={d.icon}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const MusicDJ = ({ onBack }: { onBack: () => void }) => {
  const [activeNotes, setActiveNotes] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col items-center w-full h-full pb-24 overflow-y-auto relative z-10">
      <Header 
        title="Music DJ" 
        onBack={onBack} 
        rightContent={<div className="text-xl sm:text-2xl font-black text-[--color-bento-pink] uppercase flex items-center gap-2 animate-bounce"><PartyPopper /> GO!</div>}
      />
      
      <div className="mb-6 px-6 text-center">
         <p className="text-lg font-bold text-[--color-bento-ink]/60 uppercase">Tap to play notes & lights!</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 sm:p-10 w-full max-w-6xl">
        {DEVICES.map((d, i) => (
          <div key={d.id} className={i % 2 === 0 ? 'sm:col-span-2' : ''}>
            <div 
              onClick={() => {
                playSound('note', d.note);
                setActiveNotes(prev => ({ ...prev, [d.id]: true }));
                setTimeout(() => setActiveNotes(prev => ({ ...prev, [d.id]: false })), 300);
              }}
              className={`toy-card p-4 sm:p-10 cursor-pointer flex flex-col items-center justify-center gap-4 transition-all duration-75 h-full ${activeNotes[d.id] ? d.color + ' scale-105' : 'bg-white'}`}
            >
               <motion.div
                 animate={activeNotes[d.id] ? { y: [0, -20, 0], scale: [1, 1.2, 1] } : {}}
                 className={`p-3 sm:p-4 rounded-full ${activeNotes[d.id] ? 'bg-white/40' : 'bg-slate-100'}`}
               >
                 <d.icon size={48} className={`sm:w-16 sm:h-16 ${activeNotes[d.id] ? 'text-white' : 'text-slate-400'}`} />
               </motion.div>
               <span className="text-sm sm:text-2xl font-black uppercase text-[--color-bento-ink]">{d.name}</span>
               <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${activeNotes[d.id] ? 'bg-white animate-bounce' : 'bg-slate-200'}`} style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StickerBook = ({ stickers, onBack }: { stickers: string[], onBack: () => void }) => (
  <div className="flex flex-col items-center w-full h-full pb-24 overflow-y-auto relative z-10">
    <Header title="Stickers" onBack={onBack} />
    
    <div className="p-4 sm:p-8 w-full max-w-5xl">
       <div className="toy-card bg-white p-6 sm:p-10 mb-6 sm:mb-8 border-dashed flex flex-col items-center gap-4">
          <Trophy size={60} className="text-yellow-500 animate-pulse" />
          <h2 className="text-2xl sm:text-5xl font-black uppercase text-center leading-none">Your Prizes</h2>
          <p className="text-sm sm:text-lg font-bold text-slate-400 uppercase">Play games to win more!</p>
       </div>

       <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-6">
          {stickers.map((s, i) => (
            <motion.div 
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.2, rotate: 5 }}
              className="toy-card bg-yellow-50 aspect-square flex items-center justify-center text-4xl sm:text-8xl sticker-pop"
            >
               {s}
            </motion.div>
          ))}
          {stickers.length === 0 && (
            <div className="col-span-full py-16 sm:py-24 text-center text-slate-300 font-black uppercase text-xl sm:text-3xl border-4 border-dashed rounded-[2rem] border-slate-200">
               Play games <br/> to win prizes!
            </div>
          )}
       </div>
    </div>
  </div>
);

const ABCMode = ({ onBack }: { onBack: () => void }) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const colors = ["toy-yellow-gradient", "toy-blue-gradient", "toy-pink-gradient", "toy-purple-gradient", "toy-orange-gradient", "toy-green-gradient"];
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center w-full h-full pb-32 overflow-y-auto relative z-10">
      <Header title="Learning ABC" onBack={onBack} />
      
      <div className="flex flex-col items-center gap-6 sm:gap-10 px-4 w-full max-w-6xl">
        <motion.div 
          key={activeLetter}
          initial={{ scale: 0.5, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          className="toy-card bg-white w-48 h-48 sm:w-80 sm:h-80 flex items-center justify-center text-[100px] sm:text-[200px] font-black text-[--color-toy-ink] shadow-2xl relative"
        >
          {activeLetter || "✨"}
          <div className="absolute -top-4 -right-4 bg-yellow-400 text-white p-2 rounded-full toy-card text-lg sm:text-2xl">
            ABC
          </div>
        </motion.div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3 sm:gap-5 w-full pb-10">
          {alphabet.map((letter, i) => (
            <motion.button
              key={letter}
              whileHover={{ scale: 1.1, zIndex: 50 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setActiveLetter(letter);
                playSound('abc', letter);
              }}
              className={`toy-card ${colors[i % colors.length]} aspect-square flex items-center justify-center text-3xl sm:text-6xl font-black text-white shadow-lg transition-all`}
            >
              {letter}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [mode, setMode] = useState<Mode>('menu');
  const [stickers, setStickers] = useState<string[]>([]);
  const [showStickerWin, setShowStickerWin] = useState<string | null>(null);

  const addSticker = (s: string) => {
    setStickers(prev => [...prev, s]);
    setShowStickerWin(s);
    setTimeout(() => setShowStickerWin(null), 3000);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center overflow-hidden safe-h-screen bg-[--color-toy-bg]">
      {/* Dynamic 3D World Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[10%] left-[5%] text-[120px] animate-float opacity-30">☁️</div>
         <div className="absolute top-[15%] right-[10%] text-[90px] animate-float-delayed opacity-30">☁️</div>
         <div className="absolute bottom-[20%] left-[10%] text-[150px] animate-float opacity-40">🌸</div>
         <div className="absolute bottom-[25%] right-[15%] text-[80px] animate-float-delayed opacity-40">🎈</div>
         
         {/* Stage Floor */}
         <div className="absolute bottom-0 w-full h-[35%] bg-gradient-to-t from-emerald-500/20 to-transparent pointer-events-none" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -50 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className="w-full h-full flex flex-col items-center justify-center relative"
        >
          {mode === 'menu' && (
            <div className="flex flex-col items-center gap-6 sm:gap-10 w-full px-4 h-full py-10 relative z-10 overflow-hidden">
              <motion.div 
                initial={{ scale: 0.5, y: -100 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white px-10 sm:px-16 py-4 sm:py-6 rounded-[3rem] border-[5px] sm:border-[8px] border-[--color-toy-ink] shadow-[0_12px_0_rgba(30,41,59,0.9)]"
              >
                <h1 className="text-4xl sm:text-8xl font-black text-[--color-toy-ink] uppercase tracking-tight whitespace-nowrap drop-shadow-sm">
                  🏠 Switch Play
                </h1>
              </motion.div>
              <Menu setMode={setMode} stickerCount={stickers.length} />
            </div>
          )}

          {mode === 'board' && <Board onBack={() => setMode('menu')} />}
          {mode === 'follow-me' && <FollowMe onBack={() => setMode('menu')} addSticker={addSticker} />}
          {mode === 'puzzle' && <Puzzle onBack={() => setMode('menu')} />}
          {mode === 'dark-room' && <DarkRoom onBack={() => setMode('menu')} />}
          {mode === 'music-dj' && <MusicDJ onBack={() => setMode('menu')} />}
          {mode === 'abc' && <ABCMode onBack={() => setMode('menu')} />}
          {mode === 'stickers' && <StickerBook stickers={stickers} onBack={() => setMode('menu')} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showStickerWin && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[200] pointer-events-none p-4"
          >
            <div className="toy-card bg-white p-10 sm:p-20 flex flex-col items-center gap-8 pointer-events-auto border-dashed border-yellow-400 shadow-[0_20px_0_rgba(251,191,36,1)]">
               <span className="text-[150px] sm:text-[250px] sticker-pop leading-none drop-shadow-2xl">{showStickerWin}</span>
               <h2 className="text-4xl sm:text-7xl font-black uppercase text-center leading-tight drop-shadow-sm">Mega Prize!</h2>
               <div className="flex gap-4">
                  <Star className="text-yellow-400 fill-yellow-400 drop-shadow-md" size={48} />
                  <Star className="text-yellow-400 fill-yellow-400 drop-shadow-md" size={60} />
                  <Star className="text-yellow-400 fill-yellow-400 drop-shadow-md" size={48} />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {mode !== 'menu' && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-4 sm:bottom-10 left-4 right-4 flex pointer-events-none z-50 overflow-x-auto"
        >
          <div className="flex gap-3 sm:gap-6 mx-auto pointer-events-auto p-2 sm:p-4 bg-white/60 backdrop-blur-xl rounded-[2.5rem] toy-card">
            {['board', 'follow-me', 'abc', 'music-dj', 'puzzle', 'dark-room'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  playSound('click');
                  setMode(m as Mode);
                }}
                className={`!rounded-[1.5rem] sm:!rounded-[2rem] px-4 sm:px-8 py-3 sm:py-5 font-black uppercase text-[12px] sm:text-lg tracking-wide transition-all shadow-md ${mode === m ? 'toy-pink-gradient text-white scale-110 shadow-xl' : 'bg-white text-[--color-toy-ink] hover:bg-slate-50'}`}
              >
                {m === 'dark-room' ? 'DARK' : (m === 'music-dj' ? 'DJ' : (m === 'abc' ? 'ABC' : m.split('-')[0]))}
              </button>
            ))}
            <button
                onClick={() => {
                  playSound('click');
                  setMode('menu');
                }}
                className={`!rounded-xl sm:!rounded-2xl px-4 sm:px-8 py-3 sm:py-5 font-black uppercase text-[12px] sm:text-lg tracking-wide bg-white text-[--color-toy-ink] hover:bg-slate-50 shadow-md`}
              >
                HOME
              </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
