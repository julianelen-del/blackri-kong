import { useCallback, useEffect, useRef, useState } from 'react';
import { EndModal } from './components/EndModal';
import { GameHUD } from './components/GameHUD';
import { IntroModal } from './components/IntroModal';
import { GameEngine } from './game/GameEngine';
import type { HudSnapshot, InputState, MatchStats } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'intro',
  lives: 3,
  maxLives: 3,
  score: 0,
  elapsedSeconds: 0,
  paltasThrown: 0,
  policeDefeated: 0,
  policeJumped: 0,
  currentLevel: 0,
  hintText: null,
  lastBonusText: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [muted, setMuted] = useState(false);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    try {
      const engine = new GameEngine(
        mount,
        (snapshot) => setHud(snapshot),
        (stats) => setMatchStats(stats),
      );
      engineRef.current = engine;

      const onKeyDown = (e: KeyboardEvent) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            engine.setInput({ left: true });
            break;
          case 'ArrowRight':
          case 'KeyD':
            engine.setInput({ right: true });
            break;
          case 'ArrowUp':
          case 'KeyW':
            engine.setInput({ up: true });
            break;
          case 'ArrowDown':
          case 'KeyS':
            engine.setInput({ down: true });
            break;
          case 'Space':
            if (!e.repeat) engine.setInput({ jumpPressed: true });
            break;
          case 'KeyF':
          case 'KeyX':
          case 'KeyJ':
          case 'Enter':
            if (!e.repeat) engine.setInput({ throwPressed: true });
            break;
          case 'Escape':
          case 'KeyP':
            if (!e.repeat) engine.togglePause();
            break;
          case 'KeyM':
            if (!e.repeat) setMuted(engine.toggleMute());
            break;
        }
      };

      const onKeyUp = (e: KeyboardEvent) => {
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            engine.setInput({ left: false });
            break;
          case 'ArrowRight':
          case 'KeyD':
            engine.setInput({ right: false });
            break;
          case 'ArrowUp':
          case 'KeyW':
            engine.setInput({ up: false });
            break;
          case 'ArrowDown':
          case 'KeyS':
            engine.setInput({ down: false });
            break;
        }
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        engine.dispose();
        engineRef.current = null;
      };
    } catch {
      setWebglError(true);
    }
  }, []);

  const handleStart = useCallback(() => {
    setMatchStats(null);
    engineRef.current?.startGame();
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!engineRef.current) return;
    setMuted(engineRef.current.toggleMute());
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleVirtualInput = useCallback((patch: Partial<InputState>) => {
    engineRef.current?.setInput(patch);
  }, []);

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (hud.phase === 'playing' && e.pointerType === 'mouse') {
        engineRef.current?.setInput({ throwPressed: true });
      }
    },
    [hud.phase],
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#070B14]">
      {/* Dedicated Game Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        onPointerDown={handleCanvasPointerDown}
        className="h-full w-full touch-none"
        aria-label="Escenario de Blackri Kong en Buenos Aires"
      />

      {webglError && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070B14] p-6 text-center">
          <div className="max-w-md rounded-2xl border border-white/15 bg-[#0B111E] p-6">
            <img
              src="/assets/aistudio/image_368a97cf_2d324249.jpg"
              alt="Escenario Buenos Aires"
              referrerPolicy="no-referrer"
              className="mb-4 w-full rounded-lg object-cover"
            />
            <h1 className="font-display text-3xl font-bold text-amber-400">
              No se pudo iniciar el juego
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Recargá la página para inicializar el lienzo de BLACKRI KONG.
            </p>
          </div>
        </div>
      )}

      {/* Semantic HUD Overlay */}
      {hud.phase !== 'intro' && (
        <GameHUD
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onRestart={handleStart}
          onVirtualInput={handleVirtualInput}
        />
      )}

      {/* Opening Title Plaque */}
      {hud.phase === 'intro' && <IntroModal onStart={handleStart} />}

      {/* Victory / Game Over Modal with Social Share */}
      {(hud.phase === 'victory' || hud.phase === 'gameover') && matchStats && (
        <EndModal stats={matchStats} onPlayAgain={handleStart} />
      )}
    </main>
  );
}
