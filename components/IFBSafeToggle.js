'use client'

import { useState } from 'react'
import { ShieldCheck, ShieldOff, Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function IFBSafeToggle({ ifbSafeMode, onChange }) {
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch('/api/voicemeeter/ifb-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !ifbSafeMode }),
      })
      const data = await res.json()
      if (onChange) onChange(data.ifbSafeMode)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel p-6 flex flex-col items-center gap-4">
      {/* Status label */}
      <p className="label-xs">IFB Monitor Feed</p>

      {/* Big toggle button — the main control */}
      <button
        onClick={toggle}
        disabled={loading}
        className={cn(
          'relative w-full max-w-xs py-6 rounded-xl font-bold text-lg tracking-wide transition-all duration-200',
          'flex flex-col items-center gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1d27]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          ifbSafeMode
            ? 'bg-green-900 border-2 border-green-600 text-green-300 hover:bg-green-800 focus:ring-green-600 shadow-[0_0_20px_rgba(56,161,105,0.3)]'
            : 'bg-red-900 border-2 border-red-600 text-red-300 hover:bg-red-800 focus:ring-red-600 shadow-[0_0_20px_rgba(229,62,62,0.3)]'
        )}
      >
        {ifbSafeMode ? (
          <>
            <ShieldCheck size={36} className="text-green-400" />
            <span>IFB SAFE</span>
            <span className="text-xs font-normal opacity-75">Mics excluded from earpiece feed</span>
          </>
        ) : (
          <>
            <ShieldOff size={36} className="text-red-400" />
            <span>IFB UNSAFE</span>
            <span className="text-xs font-normal opacity-75">Presenters can hear themselves</span>
          </>
        )}
      </button>

      {/* Signal flow diagram */}
      <div className="w-full max-w-xs text-xs text-slate-500 space-y-1 pt-2 border-t border-[#2a2d3a]">
        <p className="label-xs mb-2">Current IFB receives:</p>
        <div className="flex items-center gap-2">
          {ifbSafeMode
            ? <MicOff size={12} className="text-red-500 shrink-0" />
            : <Mic size={12} className="text-green-500 shrink-0" />}
          <span className={ifbSafeMode ? 'line-through text-slate-600' : 'text-slate-300'}>
            DJI Mics (presenter voices)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-px bg-green-500 shrink-0 inline-block" />
          <span className="text-slate-300">Computer audio (music, SFX, playback)</span>
        </div>
      </div>
    </div>
  )
}
