import { useEffect } from 'react'
import {
  animate,
  useMotionValue,
  useTransform,
  motion,
  useReducedMotion,
} from 'motion/react'

import { EASE_OUT_EXPO } from './motion'

/**
 * Tweens from 0 → `value` on mount and on subsequent value changes.
 * Respects `prefers-reduced-motion` by snapping to the final value.
 */
export function AnimatedNumber({
  value,
  duration = 1.1,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: {
  value: number
  duration?: number
  decimals?: number
  suffix?: string
  prefix?: string
  className?: string
}) {
  const reduced = useReducedMotion()
  const mv = useMotionValue(reduced ? value : 0)
  const rounded = useTransform(mv, (latest) => {
    const factor = 10 ** decimals
    const rounded = Math.round(latest * factor) / factor
    const text = decimals > 0 ? rounded.toFixed(decimals) : rounded.toString()
    return `${prefix}${text}${suffix}`
  })

  useEffect(() => {
    if (reduced) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, {
      duration,
      ease: EASE_OUT_EXPO,
    })
    return () => controls.stop()
  }, [value, duration, mv, reduced])

  return <motion.span className={className}>{rounded}</motion.span>
}
