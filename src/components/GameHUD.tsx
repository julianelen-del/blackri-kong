import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Gamepad2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { HudSnapshot, InputState } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  isPortraitMobile: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onVirtualInput: (patch: Partial<InputState>) => void;
}

interface GamePortraitTopBarProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}

interface GamePortraitControlDeckProps {
  onVirtualInput: (patch: Partial<InputState>) => void;
}

function AvocadoLifeIcon({ active, compact = false }: { active: boolean; compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 40"
      className={`${
        compact
          ? 'h-6 w-5'
          : 'h-7 w-5 sm:h-9 sm:w-7 [@media(max-height:480px)]:h-6 [@media(max-height:480px)]:w-5'
      } transition-transform duration-200 ${active ? 'opacity-100 scale-100' : 'opacity-25 scale-90 grayscale'}`}
      aria-hidden="true"
    >
      <path
        d="M16 2 C22 2 28 14 28 24 C28 33 23 38 16 38 C9 38 4 33 4 24 C4 14 10 2 16 2 Z"
        fill="#1E3F1C"
        stroke="#0F172A"
        strokeWidth="2"
      />
      <path
        d="M16 5 C20.5 5 25 15 25 24 C25 31 21 35 16 35 C11 35 7 31 7 24 C7 15 11.5 5 16 5 Z"
        fill="#A3E635"
      />
      <circle cx="16" cy="25.5" r="5.5" fill="#78350F" />
      <circle cx="14.5" cy="23.8" r="1.6" fill="#B45309" />
    </svg>
  );
}

function useVirtualPadBinders(onVirtualInput: (patch: Partial<InputState>) => void) {
  const bindHoldButton = (key: 'left' | 'right' | 'up' | 'down') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      onVirtualInput({ [key]: true });
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onVirtualInput({ [key]: false });
    },
    onPointerCancel: () => onVirtualInput({ [key]: false }),
    onLostPointerCapture: () => onVirtualInput({ [key]: false }),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const bindActionButton = (key: 'jumpPressed' | 'throwPressed') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onVirtualInput({ [key]: true });
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return { bindHoldButton, bindActionButton };
}

export function GamePortraitTopBar({
  hud,
  muted,
  onToggleMute,
  onTogglePause,
  onRestart,
}: GamePortraitTopBarProps) {
  const mins = String(Math.floor(hud.elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(hud.elapsedSeconds % 60).padStart(2, '0');

  return (
    <header className="z-20 flex shrink-0 items-center justify-between gap-2 border-b border-white/12 bg-[#0B111E] px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-md">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-0.5" aria-label={`Vidas: ${hud.lives} de ${hud.maxLives}`}>
          {Array.from({ length: hud.maxLives }).map((_, idx) => (
            <AvocadoLifeIcon key={idx} active={idx < hud.lives} compact />
          ))}
        </div>

        <div className="h-6 w-px bg-white/12" aria-hidden="true" />

        <div className="flex flex-col">
          <span className="text-[9px] font-semibold leading-none tracking-wider text-slate-400">
            PUNTOS
          </span>
          <span className="font-mono-tabular mt-0.5 text-base font-bold leading-none text-amber-400">
            {hud.score.toLocaleString('es-AR')}
          </span>
        </div>

        <div className="h-6 w-px bg-white/12" aria-hidden="true" />

        <div className="flex flex-col">
          <span className="text-[9px] font-semibold leading-none tracking-wider text-slate-400">
            PISO {hud.currentLevel + 1}/5
          </span>
          <span className="font-mono-tabular mt-0.5 text-xs font-semibold leading-none text-slate-200">
            {mins}:{secs}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 active:bg-white/10"
        >
          {muted ? <VolumeX className="h-4.5 w-4.5 text-rose-400" /> : <Volume2 className="h-4.5 w-4.5 text-lime-400" />}
        </button>

        {(hud.phase === 'playing' || hud.phase === 'paused') && (
          <>
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={hud.phase === 'paused' ? 'Reanudar partida' : 'Pausar partida'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 active:bg-white/10"
            >
              {hud.phase === 'paused' ? <Play className="h-4.5 w-4.5 text-amber-400" /> : <Pause className="h-4.5 w-4.5" />}
            </button>
            <button
              type="button"
              onClick={onRestart}
              aria-label="Reiniciar partida"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 active:bg-white/10"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export function GamePortraitControlDeck({ onVirtualInput }: GamePortraitControlDeckProps) {
  const { bindHoldButton, bindActionButton } = useVirtualPadBinders(onVirtualInput);

  return (
    <div className="z-20 flex shrink-0 touch-none select-none items-center justify-between border-t border-white/12 bg-[#0B111E] px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
      {/* Multi-touch D-Pad */}
      <div className="grid grid-cols-3 gap-1.5">
        <div />
        <button
          type="button"
          aria-label="Subir escalera"
          {...bindHoldButton('up')}
          className="flex h-12 w-12 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-[#131D33] text-slate-100 shadow-md active:bg-amber-500 active:text-slate-950"
        >
          <ArrowUp className="h-6 w-6" />
        </button>
        <div />
        <button
          type="button"
          aria-label="Mover a la izquierda"
          {...bindHoldButton('left')}
          className="flex h-12 w-12 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-[#131D33] text-slate-100 shadow-md active:bg-amber-500 active:text-slate-950"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Bajar escalera"
          {...bindHoldButton('down')}
          className="flex h-12 w-12 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-[#131D33] text-slate-100 shadow-md active:bg-amber-500 active:text-slate-950"
        >
          <ArrowDown className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Mover a la derecha"
          {...bindHoldButton('right')}
          className="flex h-12 w-12 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-[#131D33] text-slate-100 shadow-md active:bg-amber-500 active:text-slate-950"
        >
          <ArrowRight className="h-6 w-6" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...bindActionButton('throwPressed')}
          className="h-16 min-w-[82px] touch-none select-none rounded-2xl border border-lime-400/50 bg-lime-500 px-4 font-display text-xl font-extrabold tracking-wide text-slate-950 shadow-lg active:scale-95"
        >
          PALTA
        </button>
        <button
          type="button"
          {...bindActionButton('jumpPressed')}
          className="h-16 min-w-[88px] touch-none select-none rounded-2xl border border-amber-400/50 bg-amber-500 px-4 font-display text-xl font-extrabold tracking-wide text-slate-950 shadow-lg active:scale-95"
        >
          SALTAR
        </button>
      </div>
    </div>
  );
}

export function GameHUD({
  hud,
  muted,
  isPortraitMobile,
  onToggleMute,
  onTogglePause,
  onRestart,
  onVirtualInput,
}: GameHUDProps) {
  const [forceTouchPad, setForceTouchPad] = useState<boolean | null>(null);
  const { bindHoldButton, bindActionButton } = useVirtualPadBinders(onVirtualInput);

  const mins = String(Math.floor(hud.elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(hud.elapsedSeconds % 60).padStart(2, '0');

  const touchPadVisibilityClass =
    forceTouchPad === true
      ? 'flex'
      : forceTouchPad === false
        ? 'hidden'
        : 'flex sm:hidden [@media(pointer:coarse)]:flex';

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex flex-col ${
        isPortraitMobile
          ? 'justify-center p-3'
          : 'justify-between pt-[max(0.6rem,env(safe-area-inset-top))] pb-[max(0.6rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:p-5 [@media(max-height:480px)]:py-2'
      }`}
    >
      {/* Top Bar (Landscape Mobile & Desktop only — Portrait Mobile renders GamePortraitTopBar above canvas) */}
      {!isPortraitMobile && (
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          {/* Top-Left: Avocado Lives & Score */}
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/12 bg-[#0B111E]/85 px-2.5 py-1.5 shadow-lg sm:gap-4 sm:px-4 sm:py-2.5 [@media(max-height:480px)]:px-2.5 [@media(max-height:480px)]:py-1.5">
            <div className="flex items-center gap-1" aria-label={`Vidas: ${hud.lives} de ${hud.maxLives}`}>
              {Array.from({ length: hud.maxLives }).map((_, idx) => (
                <AvocadoLifeIcon key={idx} active={idx < hud.lives} />
              ))}
            </div>

            <div className="h-6 w-px bg-white/12 sm:h-7" aria-hidden="true" />

            <div className="flex flex-col">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 sm:text-[11px]">
                PUNTOS
              </span>
              <span className="font-mono-tabular text-base font-bold leading-none text-amber-400 sm:text-xl [@media(max-height:480px)]:text-base">
                {hud.score.toLocaleString('es-AR')}
              </span>
            </div>

            <div className="hidden h-7 w-px bg-white/12 sm:block" aria-hidden="true" />

            <div className="hidden flex-col sm:flex">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 sm:text-[11px]">
                TIEMPO · NIVEL
              </span>
              <span className="font-mono-tabular text-xs font-semibold leading-tight text-slate-100 sm:text-sm">
                {mins}:{secs} <span className="text-slate-500">·</span> Piso {hud.currentLevel + 1}/5
              </span>
            </div>
          </div>

          {/* Top-Right: Audio, Touch Pad Toggle & Game Actions */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/12 bg-[#0B111E]/85 p-1 shadow-lg sm:gap-1.5 sm:p-1.5">
            <button
              type="button"
              onClick={() => setForceTouchPad((prev) => (prev === null ? true : !prev))}
              aria-label="Mostrar u ocultar controles táctiles"
              title="Controles táctiles en pantalla"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-400 sm:h-10 sm:w-10 [@media(max-height:480px)]:h-8 [@media(max-height:480px)]:w-8"
            >
              <Gamepad2 className={`h-4.5 w-4.5 sm:h-5 sm:w-5 ${forceTouchPad ? 'text-amber-400' : 'text-slate-300'}`} />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-400 sm:h-10 sm:w-10 [@media(max-height:480px)]:h-8 [@media(max-height:480px)]:w-8"
              title={muted ? 'Activar sonido' : 'Silenciar'}
            >
              {muted ? <VolumeX className="h-4.5 w-4.5 text-rose-400 sm:h-5 sm:w-5" /> : <Volume2 className="h-4.5 w-4.5 text-lime-400 sm:h-5 sm:w-5" />}
            </button>

            {(hud.phase === 'playing' || hud.phase === 'paused') && (
              <>
                <button
                  type="button"
                  onClick={onTogglePause}
                  aria-label={hud.phase === 'paused' ? 'Reanudar partida' : 'Pausar partida'}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-400 sm:h-10 sm:w-10 [@media(max-height:480px)]:h-8 [@media(max-height:480px)]:w-8"
                  title={hud.phase === 'paused' ? 'Reanudar' : 'Pausar'}
                >
                  {hud.phase === 'paused' ? <Play className="h-4.5 w-4.5 text-amber-400 sm:h-5 sm:w-5" /> : <Pause className="h-4.5 w-4.5 sm:h-5 sm:w-5" />}
                </button>
                <button
                  type="button"
                  onClick={onRestart}
                  aria-label="Reiniciar partida"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-400 sm:h-10 sm:w-10 [@media(max-height:480px)]:h-8 [@media(max-height:480px)]:w-8"
                  title="Reiniciar"
                >
                  <RotateCcw className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Center Dynamic Feedback Banner */}
      <div className="flex flex-col items-center justify-center gap-2">
        {hud.phase === 'paused' && (
          <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#0B111E]/95 px-6 py-5 text-center shadow-2xl sm:px-8 sm:py-6">
            <h2 className="font-display text-3xl font-extrabold tracking-wide text-amber-400 sm:text-4xl">
              PARTIDA EN PAUSA
            </h2>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              Presioná Reanudar para seguir subiendo hacia Blackri Kong.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3 sm:mt-5">
              <button
                type="button"
                onClick={onTogglePause}
                className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
              >
                Reanudar
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 whitespace-nowrap"
              >
                Reiniciar
              </button>
            </div>
          </div>
        )}

        {hud.lastBonusText && hud.phase === 'playing' && (
          <div className="rounded-lg border border-lime-400/35 bg-[#0B111E]/90 px-3.5 py-1 font-display text-xl font-extrabold tracking-wide text-lime-400 shadow-lg sm:px-4 sm:py-1.5 sm:text-2xl">
            {hud.lastBonusText}
          </div>
        )}

        {hud.hintText && hud.phase === 'playing' && (
          <div className="max-w-md rounded-lg border border-amber-400/40 bg-[#0B111E]/92 px-3.5 py-1.5 text-center text-xs font-medium text-amber-200 shadow-lg sm:px-4 sm:py-2 sm:text-sm">
            {hud.hintText}
          </div>
        )}
      </div>

      {/* Bottom: Keyboard hint on desktop + Multi-touch virtual gamepad on landscape mobile */}
      {hud.phase === 'playing' && !isPortraitMobile && (
        <div className="flex flex-col gap-2">
          <div className="hidden items-center gap-3 self-start rounded-lg border border-white/10 bg-[#0B111E]/85 px-3.5 py-2 text-xs text-slate-300 sm:flex [@media(pointer:coarse)]:hidden">
            <span>Mover: A / D o Flechas</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>Escaleras: W / S o ↑ / ↓</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>Saltar: Espacio</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>Lanzar Palta: F o Click</span>
          </div>

          <div className={`pointer-events-auto w-full items-end justify-between select-none touch-none ${touchPadVisibilityClass}`}>
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
              <div />
              <button
                type="button"
                aria-label="Subir escalera"
                {...bindHoldButton('up')}
                className="flex h-11 w-11 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-[#0B111E]/78 text-slate-100 shadow-md active:bg-amber-500 active:text-slate-950 [@media(max-height:430px)]:h-9 [@media(max-height:430px)]:w-9"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Mover a la izquierda"
                {...bindHoldButton('left')}
                className="flex h-11 w-11 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-[#0B111E]/78 text-slate-100 shadow-md active:bg-amber-500 active:text-slate-950 [@media(max-height:430px)]:h-9 [@media(max-height:430px)]:w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Bajar escalera"
                {...bindHoldButton('down')}
                className="flex h-11 w-11 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-[#0B111E]/78 text-slate-100 shadow-md active:bg-amber-500 active:text-slate-950 [@media(max-height:430px)]:h-9 [@media(max-height:430px)]:w-9"
              >
                <ArrowDown className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Mover a la derecha"
                {...bindHoldButton('right')}
                className="flex h-11 w-11 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-[#0B111E]/78 text-slate-100 shadow-md active:bg-amber-500 active:text-slate-950 [@media(max-height:430px)]:h-9 [@media(max-height:430px)]:w-9"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                {...bindActionButton('throwPressed')}
                className="h-14 min-w-[74px] touch-none select-none rounded-2xl border border-lime-400/50 bg-lime-500/92 px-3.5 font-display text-lg font-extrabold tracking-wide text-slate-950 shadow-lg active:scale-95 sm:h-16 sm:min-w-[82px] sm:text-xl [@media(max-height:430px)]:h-12"
              >
                PALTA
              </button>
              <button
                type="button"
                {...bindActionButton('jumpPressed')}
                className="h-14 min-w-[80px] touch-none select-none rounded-2xl border border-amber-400/50 bg-amber-500/92 px-3.5 font-display text-lg font-extrabold tracking-wide text-slate-950 shadow-lg active:scale-95 sm:h-16 sm:min-w-[88px] sm:text-xl [@media(max-height:430px)]:h-12"
              >
                SALTAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
