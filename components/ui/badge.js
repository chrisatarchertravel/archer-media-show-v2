import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-slate-700 text-slate-200',
  success: 'bg-green-900 text-green-300 border border-green-700',
  danger: 'bg-red-900 text-red-300 border border-red-700',
  warning: 'bg-amber-900 text-amber-300 border border-amber-700',
  info: 'bg-blue-900 text-blue-300 border border-blue-700',
}

export function Badge({ children, variant = 'default', className }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', variants[variant], className)}>
      {children}
    </span>
  )
}
