import { useState } from 'react';
import { Check, Copy, Download, RotateCcw, Share2, Trophy, Skull } from 'lucide-react';
import type { MatchStats } from '../game/types';

interface EndModalProps {
  stats: MatchStats;
  onPlayAgain: () => void;
}

export function EndModal({ stats, onPlayAgain }: EndModalProps) {
  const [copied, setCopied] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState<string | null>(null);

  const mins = Math.floor(stats.timeSeconds / 60);
  const secs = String(stats.timeSeconds % 60).padStart(2, '0');
  const timeFormatted = `${mins}:${secs}`;

  const shareText = stats.won
    ? `¡Derroté a Blackri Kong en la cima del Obelisco con el vendedor de paltas! Puntaje: ${stats.score.toLocaleString('es-AR')} pts · Tiempo: ${timeFormatted} · Policías derribados: ${stats.policeDefeated}. Jugalo en BARCEGAMER: BLACKRI KONG.`
    : `Luché contra los policías de Blackri Kong en Buenos Aires y sumé ${stats.score.toLocaleString('es-AR')} pts en ${timeFormatted}. ¿Podés llegar a la cima con el vendedor de paltas?`;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setSharedFeedback('No se pudo acceder al portapapeles.');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'BARCEGAMER PRESENTA: BLACKRI KONG',
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled share sheet
      }
    } else {
      await handleCopy();
    }
  };

  const handleDownloadCard = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Night Buenos Aires background gradient
    const bg = ctx.createLinearGradient(0, 0, 1200, 630);
    bg.addColorStop(0, '#070B14');
    bg.addColorStop(0.55, '#0F172A');
    bg.addColorStop(1, '#1E293B');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 630);

    // Subtle Obelisco silhouette in center-right
    ctx.fillStyle = 'rgba(251, 191, 36, 0.14)';
    ctx.beginPath();
    ctx.moveTo(960, 100);
    ctx.lineTo(1000, 150);
    ctx.lineTo(1025, 580);
    ctx.lineTo(895, 580);
    ctx.lineTo(920, 150);
    ctx.closePath();
    ctx.fill();

    // Frame border
    ctx.strokeStyle = stats.won ? '#84CC16' : '#F59E0B';
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, 1144, 574);

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('BARCEGAMER PRESENTA · BLACKRI KONG', 76, 98);

    ctx.fillStyle = stats.won ? '#A3E635' : '#FB7185';
    ctx.font = 'bold 76px sans-serif';
    ctx.fillText(stats.won ? '¡VICTORIA EN LA CIMA!' : 'FIN DE LA PARTIDA', 76, 192);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 54px monospace';
    ctx.fillText(`${stats.score.toLocaleString('es-AR')} PTS`, 76, 295);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '28px sans-serif';
    ctx.fillText(`Tiempo: ${timeFormatted}   ·   Vidas restantes: ${stats.livesRemaining}/3`, 76, 370);
    ctx.fillText(`Paltas lanzadas: ${stats.paltasThrown}   ·   Policías derribados: ${stats.policeDefeated}   ·   Saltos: ${stats.policeJumped}`, 76, 425);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '22px sans-serif';
    ctx.fillText('Vendedor de Paltas vs Blackri Kong · Buenos Aires Arcade 3D', 76, 540);

    const link = document.createElement('a');
    link.download = `blackri-kong-${stats.won ? 'victoria' : 'resultado'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setSharedFeedback('Tarjeta descargada.');
    window.setTimeout(() => setSharedFeedback(null), 2400);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#050811]/82 p-3 sm:p-4">
      <div className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0B111E]/96 shadow-2xl">
        {/* Header */}
        <div className="border-b border-white/10 px-4 py-4 text-center sm:px-6 sm:py-6">
          <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 sm:mb-2 sm:h-12 sm:w-12">
            {stats.won ? (
              <Trophy className="h-6 w-6 text-lime-400 sm:h-7 sm:w-7" />
            ) : (
              <Skull className="h-6 w-6 text-rose-400 sm:h-7 sm:w-7" />
            )}
          </div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-amber-400 uppercase sm:text-xs">
            BARCEGAMER · BLACKRI KONG
          </p>
          <h2
            className={`mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl ${
              stats.won ? 'text-lime-400' : 'text-rose-400'
            }`}
          >
            {stats.won ? '¡GANASTE!' : 'FIN DEL JUEGO'}
          </h2>
          <p className="mt-1 text-xs text-slate-300 sm:mt-1.5 sm:text-sm">
            {stats.won
              ? '¡Llegaste a la plataforma superior y derribaste a Blackri Kong con un paltazo histórico!'
              : 'Los policías frenaron el reparto de paltas. ¡Volvé a intentarlo y llegá a la cima!'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
          <div className="bg-[#0B111E] p-3 text-center sm:p-4">
            <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">PUNTAJE</p>
            <p className="font-mono-tabular mt-0.5 text-xl font-bold text-amber-400 sm:mt-1 sm:text-2xl">
              {stats.score.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="bg-[#0B111E] p-3 text-center sm:p-4">
            <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">TIEMPO</p>
            <p className="font-mono-tabular mt-0.5 text-xl font-bold text-white sm:mt-1 sm:text-2xl">
              {timeFormatted}
            </p>
          </div>
          <div className="bg-[#0B111E] p-3 text-center sm:p-4">
            <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">POLICÍAS</p>
            <p className="font-mono-tabular mt-0.5 text-xl font-bold text-lime-400 sm:mt-1 sm:text-2xl">
              {stats.policeDefeated}
            </p>
          </div>
          <div className="bg-[#0B111E] p-3 text-center sm:p-4">
            <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">VIDAS</p>
            <p className="font-mono-tabular mt-0.5 text-xl font-bold text-white sm:mt-1 sm:text-2xl">
              {stats.livesRemaining}/3
            </p>
          </div>
        </div>

        {/* Social Share Section */}
        <div className="space-y-3 p-4 sm:space-y-4 sm:p-6">
          <div>
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Compartir resultado en redes sociales
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <a
                href={twitterHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 whitespace-nowrap"
              >
                Compartir en X
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 whitespace-nowrap"
              >
                WhatsApp
              </a>
              <a
                href={facebookHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-sky-500/35 bg-sky-500/15 px-3.5 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/25 whitespace-nowrap"
              >
                Facebook
              </a>
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/15 whitespace-nowrap"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartir
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/15 whitespace-nowrap"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-lime-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? '¡Copiado!' : 'Copiar texto'}
              </button>
              <button
                type="button"
                onClick={handleDownloadCard}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/25 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar imagen
              </button>
            </div>
            {sharedFeedback && (
              <p className="mt-2 text-xs text-lime-400">{sharedFeedback}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onPlayAgain}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 font-display text-2xl font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-white"
          >
            <RotateCcw className="h-5 w-5" />
            JUGAR DE NUEVO
          </button>
        </div>
      </div>
    </div>
  );
}
