import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, duration = 0.5, className = '' }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const end = value;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return (
    <motion.span
      key={value}
      initial={{ scale: 1.05 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {display}
    </motion.span>
  );
}
