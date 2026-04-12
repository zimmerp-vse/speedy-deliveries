import { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine } from '@/game/engine';
import { GAME_CONFIG, GameData, RoundResult } from '@/game/config';
import { GameHUD } from './GameHUD';
import { GameControls } from './GameControls';
import { RoundEndScreen } from './RoundEndScreen';
import { GameOverScreen } from './GameOverScreen';
import { StartScreen } from './StartScreen';

type GamePhase = 'start' | 'playing' | 'round-end' | 'game-over';

export function DrivingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [phase, setPhase] = useState<GamePhase>('start');
  const [speed, setSpeed] = useState(0);
  const [money, setMoney] = useState(GAME_CONFIG.startingMoney);
  const [currentRound, setCurrentRound] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(GAME_CONFIG.tripDurationMs / 1000);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    
    engine.onSpeedUpdate = setSpeed;
    engine.onMoneyUpdate = setMoney;
    engine.onTimeUpdate = setTimeRemaining;
    engine.onCelebrationChange = setCelebrating;
    engine.onRoundEnd = (result, data) => {
      setCelebrating(false);
      setLastResult(result);
      setGameData({ ...data });
      setPhase('round-end');
    };
    engine.onGameEnd = (data) => {
      setCelebrating(false);
      setGameData({ ...data });
      setPhase('game-over');
    };
    
    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== 'playing') return;
    
    const keyMap: Record<string, string> = {
      ArrowUp: 'accelerate', ArrowDown: 'brake',
      ArrowLeft: 'left', ArrowRight: 'right',
      w: 'accelerate', s: 'brake', a: 'left', d: 'right',
      ' ': 'horn', h: 'horn',
    };
    
    const onKey = (e: KeyboardEvent, pressed: boolean) => {
      const control = keyMap[e.key];
      if (control) {
        e.preventDefault();
        engine.setControls({ [control]: pressed });
      }
    };
    
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && engine.isCelebrating()) {
        e.preventDefault();
        engine.skipCelebration();
        return;
      }
      onKey(e, true);
    };

    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && engine.isCelebrating()) {
        e.preventDefault();
        return;
      }
      onKey(e, false);
    };
    
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [phase]);

  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setCelebrating(false);
    setPhase('playing');
    setCurrentRound(1);
    engine.startRound();
  }, []);

  const nextRound = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setCelebrating(false);
    setPhase('playing');
    setCurrentRound(engine.getCurrentRound() + 1);
    engine.startRound();
  }, []);

  const handleControl = useCallback((control: string, pressed: boolean) => {
    engineRef.current?.setControls({ [control]: pressed });
  }, []);

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {phase === 'start' && <StartScreen onStart={startGame} />}
      
      {phase === 'playing' && (
        <>
          <GameHUD
            speed={speed}
            money={money}
            round={currentRound}
            totalRounds={GAME_CONFIG.totalRounds}
            timeRemaining={timeRemaining}
          />
          {celebrating && (
            <div className="absolute top-16 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border bg-card/85 px-4 py-2 text-center text-xs font-arcade text-foreground shadow-lg backdrop-blur-sm">
              DELIVERY COMPLETE • PRESS SPACE TO SKIP
            </div>
          )}
          <GameControls onControl={handleControl} />
        </>
      )}
      
      {phase === 'round-end' && lastResult && (
        <RoundEndScreen result={lastResult} onContinue={nextRound} />
      )}
      
      {phase === 'game-over' && gameData && (
        <GameOverScreen data={gameData} />
      )}
    </div>
  );
}
