import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useReducedMotion } from 'motion/react';

export default function AnimatedPercent({ value, className = '', suffix = '%', duration = 0.4 }) {
  const reduce = useReducedMotion();
  const prev = useRef(value);
  const [flash, setFlash] = useState(null);

  const spring = useSpring(value, { stiffness: 120, damping: 22, mass: 0.6 });
  const display = useTransform(spring, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (value === prev.current) return;
    if (!reduce) {
      setFlash(value > prev.current ? 'up' : 'down');
      spring.set(value);
      const t = setTimeout(() => setFlash(null), duration * 1000);
      return () => clearTimeout(t);
    }
    spring.jump(value);
    prev.current = value;
  }, [value, reduce, spring, duration]);

  useEffect(() => {
    prev.current = value;
  }, [value, flash]);

  if (reduce) {
    return <span className={className}>{Math.round(value)}{suffix}</span>;
  }

  return (
    <motion.span
      className={className}
      animate={
        flash === 'up'
          ? { color: 'var(--color-accent-green, #2d8a6e)', scale: 1.08 }
          : flash === 'down'
            ? { color: 'var(--color-accent-red, #c44b4b)', scale: 1.08 }
            : { scale: 1 }
      }
      transition={{ duration, ease: 'easeOut' }}
      style={{ display: 'inline-block' }}
    >
      <motion.span>{display}</motion.span>
    </motion.span>
  );
}
