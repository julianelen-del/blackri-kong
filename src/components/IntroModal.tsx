import { Play } from 'lucide-react';
import { motion } from 'motion/react';

interface IntroModalProps {
  onStart: () => void;
}

export function IntroModal({ onStart }: IntroModalProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#050811]/62 p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0B111E]/92 shadow-2xl"
      >
        {/* Top Banner */}
        <div className="border-b border-white/10 bg-gradient-to-r from-[#0F172A] via-[#172136] to-[#0F172A] px-4 py-3.5 text-center sm:px-8 sm:py-5">
          <p className="font-display text-xs font-bold tracking-[0.22em] text-amber-400 uppercase sm:text-sm">
            BARCEGAMER PRESENTA
          </p>
          <h1 className="mt-0.5 font-display text-4xl font-extrabold tracking-tight text-white sm:mt-1 sm:text-6xl">
            BLACKRI KONG
          </h1>
          <p className="mx-auto mt-1.5 max-w-xl text-xs leading-relaxed text-slate-300 sm:mt-2 sm:text-base">
            En plena noche porteña, Blackri Kong se atrincheró en la cima de la obra y arroja
            policías por las vigas de acero para frenar al vendedor ambulante.
          </p>
        </div>

        {/* Content Body */}
        <div className="grid gap-4 p-4 sm:grid-cols-12 sm:gap-6 sm:p-7">
          {/* Animated Character Visuals */}
          <div className="grid grid-cols-2 gap-3 sm:col-span-5">
            {/* Vendor Card */}
            <motion.div
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.96 }}
              className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-lime-400/25 bg-[#11192B]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                <motion.img
                  src="/assets/aistudio/image_128bacf0_da080b28.jpg"
                  alt="El vendedor de paltas"
                  referrerPolicy="no-referrer"
                  animate={{
                    y: [0, -7, 0, -4, 0],
                    rotate: [-1.5, 1.5, -1, 1.5, -1.5],
                    scaleY: [1, 1.03, 0.97, 1.02, 1],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="h-full w-full origin-bottom object-cover object-left-top"
                />
                {/* Animated Floating Avocado */}
                <motion.svg
                  viewBox="0 0 32 40"
                  aria-hidden="true"
                  animate={{
                    y: [4, -6, 4],
                    rotate: [-14, 14, -14],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="pointer-events-none absolute right-2 top-2 h-7 w-6 drop-shadow-md"
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
                  <circle cx="16" cy="25.5" r="5" fill="#78350F" />
                </motion.svg>
              </div>
              <div className="p-2.5 text-center">
                <p className="text-xs font-bold text-lime-400">EL VENDEDOR</p>
                <p className="text-[11px] text-slate-400">Defensor de paltas</p>
              </div>
            </motion.div>

            {/* Blackri Kong Card */}
            <motion.div
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.96 }}
              className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-amber-400/25 bg-[#11192B]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                <motion.img
                  src="/assets/aistudio/image_28f8f627_58879715.jpg"
                  alt="Blackri Kong"
                  referrerPolicy="no-referrer"
                  animate={{
                    y: [0, -5, 0, -9, 0],
                    rotate: [1.5, -2, 1, -2.2, 1.5],
                    scale: [1, 1.04, 0.99, 1.05, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="h-full w-full origin-bottom object-cover object-center"
                />
              </div>
              <div className="p-2.5 text-center">
                <p className="text-xs font-bold text-amber-400">BLACKRI KONG</p>
                <p className="text-[11px] text-slate-400">Jefe en la cima</p>
              </div>
            </motion.div>
          </div>

          {/* Objective & Controls */}
          <div className="flex flex-col justify-between gap-4 sm:col-span-7 sm:gap-5">
            <div className="space-y-2.5 sm:space-y-3">
              <div>
                <h2 className="font-display text-lg font-bold tracking-wide text-white sm:text-xl">
                  OBJETIVO DE LA PARTIDA
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                  Trepá por las vigas y escaleras hasta la plataforma más alta con tus{' '}
                  <strong className="text-lime-400">3 vidas</strong>. Saltá por encima de los
                  policías o derribalos lanzando paltas. Cuando llegues a la cima,{' '}
                  <strong className="text-amber-300">acertale con una palta a Blackri Kong</strong>{' '}
                  para ganar.
                </p>
              </div>

              <div className="border-t border-white/10 pt-2.5 sm:pt-3">
                <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase sm:text-xs">
                  Controles
                </h3>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-200 sm:mt-2 sm:gap-x-4 sm:gap-y-1.5">
                  <div>
                    <span className="font-semibold text-amber-300">Cruceta / A·D</span> · Correr
                  </div>
                  <div>
                    <span className="font-semibold text-amber-300">↑·↓ / W·S</span> · Escaleras
                  </div>
                  <div>
                    <span className="font-semibold text-amber-300">Saltar / Espacio</span> · Saltar
                  </div>
                  <div>
                    <span className="font-semibold text-lime-400">F / Click / Palta</span> · Lanzar
                  </div>
                </div>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={onStart}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-amber-500 px-6 py-3 font-display text-2xl font-extrabold tracking-wide text-slate-950 shadow-lg transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-white sm:py-3.5"
            >
              <Play className="h-6 w-6 fill-current" />
              JUGAR AHORA
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
