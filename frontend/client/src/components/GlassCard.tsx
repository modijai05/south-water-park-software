import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function GlassCard({ children, className = '', delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`modern-card rounded-2xl p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
