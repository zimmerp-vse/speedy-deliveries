import { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine } from '@/game/engine';
import { GAME_CONFIG, GameData, RoundResult } from '@/game/config';
import { GameHUD } from './GameHUD';
import { GameControls } from './GameControls';
import { RoundEndScreen } from './RoundEndScreen';
import { GameOverScreen } from './GameOverScreen';
import { StartScreen } from './StartScreen';
import { embedHost } from '@/integration/host';
import { installAudioUnlock } from '@/game/sounds';
import { applyInitConfig, getInitSchedule, snapshotBaseConditions } from '@/integration/applyConfig';
import type { InitPayload, RoundEvent, GameSummary } from '@/integration/protocol';

type GamePhase = 'start' | 'playing' | 'round-end' | 'game-over';

export function DrivingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const initRef = useRef<InitPayload | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const roundsRef = useRef<RoundEvent[]>([]);
  const endedRef = useRef(false);

  const [phase, setPhase] = useState<GamePhase>('start');
  const [speed, setSpeed] = useState(0);
  const [money, setMoney] = useState(GAME_CONFIG.startingMoney);
  const [currentRound, setCurrentRound] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(GAME_CONFIG.tripDurationMs / 1000);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [playerNickname, setPlayerNickname] = useState<string | undefined>(undefined);
  const [showQuitButton, setShowQuitButton] = useState(false);
  const [showRoundTotal, setShowRoundTotal] = useState(true);
  const [timeRing, setTimeRing] = useState(false);
  // The current round's time limit, so the watch makes one full sweep per round.
  const [totalTime, setTotalTime] = useState(GAME_CONFIG.tripDurationMs / 1000);

  const buildSummary = useCallback((data: GameData, endedReason: 'completed' | 'quit'): GameSummary => {
    const accidents = {
      car: 0, obstacle: 0, pedestrian: 0, malfunction: 0, timeout: 0,
    };
    for (const r of roundsRef.current) {
      if (r.outcome === 'crash_car') accidents.car++;
      else if (r.outcome === 'crash_obstacle') accidents.obstacle++;
      else if (r.outcome === 'crash_pedestrian') accidents.pedestrian++;
      else if (r.outcome === 'malfunction') accidents.malfunction++;
      else if (r.outcome === 'timeout') accidents.timeout++;
    }
    return {
      sessionId: sessionIdRef.current,
      player: initRef.current?.player,
      endedReason,
      rounds: roundsRef.current,
      totals: { deliveries: data.totalDeliveries, money: data.totalMoney, accidents },
      extra: initRef.current?.extra,
    };
  }, []);

  // Sound starts with the player's first tap, click or key press in the game (browser rule).
  useEffect(() => installAudioUnlock(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size the drawing buffer to the canvas's displayed size. The canvas is observed
    // directly: inside an iframe (notably Safari) the first measurement can come before
    // layout, and a later size change does not always fire a window 'resize'.
    let applied = '';
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (w === 0 || h === 0 || applied === `${w}x${h}x${dpr}`) return;
      applied = `${w}x${h}x${dpr}`;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);
    // Make sure this iframe window grabs keyboard focus so arrow keys work without an extra click.
    try { window.focus(); } catch {}
    const grab = () => { try { window.focus(); } catch {} };
    window.addEventListener('pointerdown', grab);

    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    engine.onSpeedUpdate = setSpeed;
    engine.onMoneyUpdate = setMoney;
    engine.onTimeUpdate = setTimeRemaining;
    engine.onCelebrationChange = setCelebrating;
    engine.onRoundStart = ({ round, scene, deliveryType, applied }) => {
      setTotalTime((applied?.tripDurationMs ?? GAME_CONFIG.tripDurationMs) / 1000);
      embedHost.sendRoundStart(round, scene, deliveryType, sessionIdRef.current, applied);
    };
    engine.onRoundEnd = (result, data) => {
      setCelebrating(false);
      setLastResult(result);
      setGameData({ ...data });
      setPhase('round-end');

      const event: RoundEvent = {
        round: result.round,
        outcome: result.outcome,
        timeMs: result.timeMs,
        scene: result.scene,
        moneyEarned: result.moneyEarned,
        moneyLost: result.moneyLost,
        moneyBalance: data.totalMoney,
        applied: result.applied,
      };
      roundsRef.current.push(event);
      embedHost.sendRoundEnd(event, sessionIdRef.current);
    };
    engine.onGameEnd = (data, reason) => {
      setCelebrating(false);
      setGameData({ ...data });
      setPhase('game-over');
      if (!endedRef.current) {
        endedRef.current = true;
        embedHost.sendGameEnd(buildSummary(data, reason));
      }
    };

    // ---- Iframe protocol ----
    embedHost.start();
    if (embedHost.isEmbedded()) embedHost.sendReady();
    const off = embedHost.onMessageReceived((msg) => {
      if (msg.type === 'INIT') {
        initRef.current = msg.payload;
        sessionIdRef.current = msg.payload.session?.sessionId;
        const applied = applyInitConfig(msg.payload);
        // Base values are snapshotted after the INIT overrides; schedule entries go on top.
        engineRef.current?.setSchedule(getInitSchedule(msg.payload), snapshotBaseConditions());
        setShowRoundTotal(msg.payload.ui?.showRoundTotal !== false);
        setTimeRing(msg.payload.ui?.timeRing === true);
        setPlayerNickname(msg.payload.player?.nickname);
        setShowQuitButton(!!msg.payload.ui?.showQuitButton);
        setMoney(GAME_CONFIG.startingMoney);
        setTimeRemaining(GAME_CONFIG.tripDurationMs / 1000);
        embedHost.sendInitAck(applied as unknown as Record<string, unknown>, sessionIdRef.current);
        if (msg.payload.ui?.autoStart) {
          // Defer to next tick so engine refs are ready.
          setTimeout(() => {
            const engine = engineRef.current;
            if (!engine) return;
            roundsRef.current = [];
            endedRef.current = false;
            setCelebrating(false);
            setPhase('playing');
            setCurrentRound(1);
            engine.startRound();
          }, 0);
        }
      } else if (msg.type === 'QUIT') {
        engineRef.current?.quit();
      }
    });

    return () => {
      window.removeEventListener('resize', resize);
      resizeObserver?.disconnect();
      window.removeEventListener('pointerdown', grab);
      off();
      embedHost.stop();
      engine.destroy();
    };
  }, [buildSummary]);

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
      if (e.code === 'Space') {
        e.preventDefault();
        if (engine.isCelebrating()) { engine.skipCelebration(); return; }
        if (engine.isCrashScene()) { engine.skipCrash(); return; }
      }
      onKey(e, true);
    };

    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (engine.isCelebrating() || engine.isCrashScene())) {
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
    roundsRef.current = [];
    endedRef.current = false;
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

  const handleQuit = useCallback(() => {
    engineRef.current?.quit();
  }, []);

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {phase === 'start' && <StartScreen onStart={startGame} nickname={playerNickname} />}

      {phase === 'playing' && (
        <>
          <GameHUD
            speed={speed}
            money={money}
            round={currentRound}
            totalRounds={GAME_CONFIG.totalRounds}
            showRoundTotal={showRoundTotal}
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            timeRing={timeRing}
          />
          {showQuitButton && (
            <button
              onClick={handleQuit}
              className="absolute top-2 right-2 z-30 rounded-md bg-card/80 px-3 py-1 font-arcade text-[10px] text-foreground hover:bg-card"
            >
              QUIT
            </button>
          )}
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
