'use client'

import { useState } from 'react'
import { Radio, Headphones, Coffee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle } from './ui/card'

const PRESET_ICONS = {
  live: Radio,
  rehearsal: Headphones,
  break: Coffee,
}

const PRESET_STYLES = {
  live: 'border-red-700 hover:border-red-500 text-red-300',
  rehearsal: 'border-blue-700 hover:border-blue-500 text-blue-300',
  break: 'border-amber-700 hover:border-amber-500 text-amber-300',
}

export function PresetPanel({ presets = [], onPresetApplied }) {
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(null)

  async function applyPreset(key) {
    setLoading(key)
    try {
      const res = await fetch('/api/voicemeeter/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: key }),
      })
      const data = await res.json()
      if (data.ok) {
        setActive(key)
        if (onPresetApplied) onPresetApplied(data.state)
      }
    } finally {
      setLoading(null)
    }
  }

  const list = presets.length
    ? presets
    : [
        { key: 'live',      label: 'Live Mode',  description: 'Mics excluded from IFB' },
        { key: 'rehearsal', label: 'Rehearsal',  description: 'Full mix in IFB for soundcheck' },
        { key: 'break',     label: 'Break',      description: 'IFB muted' },
      ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Show Presets</CardTitle>
      </CardHeader>

      <div className="grid grid-cols-3 gap-2">
        {list.map(({ key, label, description }) => {
          const Icon = PRESET_ICONS[key] ?? Radio
          const isActive = active === key
          const isLoading = loading === key

          return (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              disabled={!!loading}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-lg border bg-[#0f1117]',
                'text-center transition-all focus:outline-none',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isActive
                  ? cn(PRESET_STYLES[key], 'bg-opacity-20')
                  : 'border-[#2a2d3a] hover:border-slate-500 text-slate-400',
                isLoading && 'animate-pulse'
              )}
            >
              <Icon size={18} />
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[10px] opacity-60 leading-tight">{description}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
