import { cn } from '@/lib/utils'

export function Card({ children, className }) {
  return (
    <div className={cn('panel p-4', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }) {
  return (
    <h3 className={cn('text-sm font-semibold text-slate-300 uppercase tracking-widest', className)}>
      {children}
    </h3>
  )
}
