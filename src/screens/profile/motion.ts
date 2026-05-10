import type { Transition, Variants } from 'motion/react'

/**
 * Shared motion language for the Profile view.
 *
 * Aesthetic: refined editorial sport-stats. Motion is precise and confident,
 * never bouncy — `easeOut` curves with optical-grade durations. Page-load
 * uses a single staggered reveal (high-impact moment) rather than many
 * scattered effects.
 */

// "Expo out" — feels confident, decelerates into rest. Used everywhere.
export const EASE_OUT_EXPO: Transition['ease'] = [0.16, 1, 0.3, 1]
// Faster, snappier easing for hover/press micro-interactions.
export const EASE_OUT_SOFT: Transition['ease'] = [0.22, 1, 0.36, 1]

export const containerStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT_EXPO },
  },
}

export const fadeUpFast: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT_EXPO },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
}

export const listStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.035, delayChildren: 0.1 },
  },
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT_EXPO },
  },
}
