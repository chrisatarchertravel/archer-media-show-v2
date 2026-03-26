import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-slate-700 hover:bg-slate-600 text-white',
  destructive: 'bg-red-700 hover:bg-red-600 text-white',
  success: 'bg-green-700 hover:bg-green-600 text-white',
  ghost: 'hover:bg-slate-800 text-slate-300',
  outline: 'border border-slate-600 hover:bg-slate-800 text-slate-300',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({ children, variant = 'default', size = 'md', className, disabled, ...props }) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
