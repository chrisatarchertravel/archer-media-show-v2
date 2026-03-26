'use client'

import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle } from './ui/card'

function GainSlider({ label, type, id, gain, highlight }) {
  const [localGain, setLocalGain] = useState(gain ?? 0)
  const [debounceTimer, setDebounceTimer] = useState(null)

  function handleChange(e) {
    const val = Number(e.target.value)
    setLocalGain(val)

    // Debounce API call so we don't spam on drag
    if (debounceTimer) clearTimeout(debounceTimer)
    setDebounceTimer(
      setTimeout(async () => {
        await fetch('/api/voicemeeter/volume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id, gain: val }),
        })
      }, 80)
    )
  }

  const dB = localGain.toFixed(1)
  const isUnity = localGain === 0
  const isMuted = localGain <= -60

  return (
    <div className={cn('flex items-center gap-3 py-2', highlight && 'bg-[#0f1117] rounded px-2 -mx-2')}>
      {isMuted
        ? <VolumeX size={14} className="text-red-500 shrink-0" />
        : <Volume2 size={14} className={cn('shrink-0', isUnity ? 'text-green-500' : 'text-slate-400')} />}

      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-slate-300 truncate">{label}</span>
          <span className={cn('text-xs font-mono ml-2 shrink-0', isUnity ? 'text-green-400' : 'text-slate-400')}>
            {dB} dB
          </span>
        </div>
        <input
          type="range"
          min={-60}
          max={12}
          step={0.5}
          value={localGain}
          onChange={handleChange}
          className={cn(
            'w-full h-1.5 rounded-full appearance-none cursor-pointer',
            'bg-[#2a2d3a]',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-300',
            '[&::-webkit-slider-thumb]:hover:bg-white'
          )}
        />
      </div>
    </div>
  )
}

export function BusVolumePanel({ strips, buses }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Levels</CardTitle>
      </CardHeader>

      <div className="space-y-1">
        <p className="label-xs mb-2">Input Strips</p>
        {strips?.filter(s => s.id <= 1).map((strip) => (
          <GainSlider
            key={strip.id}
            label={strip.label}
            type="strip"
            id={strip.id}
            gain={strip.gain}
            highlight={strip.id === 0}
          />
        ))}

        <div className="border-t border-[#2a2d3a] pt-3 mt-3">
          <p className="label-xs mb-2">Output Buses</p>
          {buses?.filter(b => b.id === 1 || b.id === 3).map((bus) => (
            <GainSlider
              key={bus.id}
              label={bus.label}
              type="bus"
              id={bus.id}
              gain={bus.gain}
              highlight={bus.id === 1}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}
