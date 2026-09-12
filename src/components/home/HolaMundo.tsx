'use client';

import { motion } from 'framer-motion';

export function HolaMundo() {
  return (
    <section className="relative flex min-h-screen items-center justify-center bg-[linear-gradient(120deg,#0f0c29,#302b63,#24243e)] bg-[length:200%_200%] px-6 text-center">
      <motion.div
        className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,#60a5fa_0,transparent_35%),radial-gradient(circle_at_80%_70%,#a78bfa_0,transparent_35%)]"
        initial={{ backgroundPosition: '0% 50%' }}
        animate={{ backgroundPosition: '100% 50%' }}
        transition={{ duration: 8, repeat: Infinity, repeatType: 'reverse' }}
      />
      <div className="relative z-10 flex max-w-4xl flex-col items-center">
        <div className="flex flex-col text-7xl font-extrabold tracking-tighter sm:text-8xl md:text-9xl">
          <motion.span
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          >
            Hola
          </motion.span>
          <motion.span
            className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
          >
            Mundo
          </motion.span>
        </div>
        <motion.div
          className="my-8 h-px w-full origin-center bg-white/30"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 1, ease: 'easeInOut' }}
        />
        <motion.p
          className="text-lg font-light tracking-wide text-white/60 sm:text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.3 }}
        >
          NovaAssistant está listo para crecer contigo.
        </motion.p>
        <motion.span
          className="mt-8 rounded-full border border-white/20 px-4 py-2 font-mono text-sm text-blue-200"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 1.6, stiffness: 260, damping: 20 }}
        >
          TypeScript
        </motion.span>
      </div>
    </section>
  );
}
