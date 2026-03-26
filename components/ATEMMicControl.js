'use client'

import { useState } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

// OFF is excluded from the mic input — muting the DJI mic channel on the ATEM
// would remove it from program output, which is never the desired behaviour.
// Presenter monitoring is controlled exclusively via IFB Safe Mode (Voicemeeter B2).
const MIX_OPTIONS_ALL = [
  { value: 'on',  label: 'ON',  description: 'Always in program mix' },
  { value: 'afv', label: 'AFV', description: 'Audio follows video' },
  { value: 'off', label: 'OFF', description: 'Muted — removes from program output' },
]
const MIX_OPTIONS_MIC = MIX_OPTIONS_ALL.filter((o) => o.value !== 'off')

function ChannelStrip({ channel, micInputId }) {
  const [gain, setGain] = useState(channel.gain ?? 0)
  const [debounceTimer, setDebounceTimer] = useState(null)
  const [mixOption, setMixOption] = useState(
    channel.muted ? 'off' : channel.mixOption === 2 ? 'afv' : 'on'
  )
  const isTheMicInput = channel.id === Number(micInputId)

  // For the designated mic input, force-reset to 'on' if it somehow ended up muted
  // so program output is never accidentally silenced via this panel
  const safeMixOption = isTheMicInput && mixOption === 'off' ? 'on' : mixOption
  const mixOptions = isTheMicInput ? MIX_OPTIONS_MIC : MIX_OPTIONS_ALL

  async function handleGainChange(e) {
    const val = Number(e.target.value)
    setGain(val)
    if (debounceTimer) clearTimeout(debounceTimer)
    setDebounceTimer(setTimeout(async () => {
      await fetch('/api/atem/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputId: channel.id, action: 'gain', value: val }),
      })
    }, 80))
  }

  async function handleMixOption(opt) {
    // Prevent muting the designated mic input — use IFB Safe Mode instead
    if (isTheMicInput && opt === 'off') return
    setMixOption(opt)
    await fetch('/api/atem/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputId: channel.id, action: 'mixOption', value: opt }),
    })
  }

  return (
    <div className={cn(
      'rounded-lg p-3 border',
      isTheMicInput
        ? 'border-amber-700 bg-amber-950/30'
        : 'border-[#2a2d3a] bg-[#0f1117]'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Mic size={12} className={isTheMicInput ? 'text-amber-400' : 'text-slate-400'} />
          <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
            {channel.label}
          </span>
          {isTheMicInput && (
            <Badge variant="warning" className="text-[10px]">DJI MIC</Badge>
          )}
        </div>
        <span className="text-xs font-mono text-slate-400">{gain.toFixed(1)} dB</span>
      </div>

      {/* Mix option buttons — only for classic mixer */}
      {channel.type === 'classic' && (
        <>
          <div className="flex gap-1 mb-2">
            {mixOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleMixOption(opt.value)}
                title={opt.description}
                className={cn(
                  'flex-1 py-1 rounded text-[10px] font-bold transition-colors',
                  safeMixOption === opt.value
                    ? 'bg-green-800 text-green-200'
                    : 'bg-[#2a2d3a] text-slate-500 hover:text-slate-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isTheMicInput && (
            <p className="text-[10px] text-amber-700 mb-2">
              Mute not available — use IFB Safe Mode to control presenter monitoring
            </p>
          )}
        </>
      )}

      {/* Gain slider */}
      <div className="flex items-center gap-2">
        <Volume2 size={11} className="text-slate-600 shrink-0" />
        <input
          type="range"
          min={-60}
          max={12}
          step={0.5}
          value={gain}
          onChange={handleGainChange}
          className={cn(
            'w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#2a2d3a]',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3',
            '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-slate-300 [&::-webkit-slider-thumb]:hover:bg-white'
          )}
        />
      </div>
    </div>
  )
}

export function ATEMMicControl({ atemState }) {
  const [micInputId, setMicInputId] = useState(
    typeof window !== 'undefined'
      ? (localStorage.getItem('micInputId') || '')
      : ''
  )
  const [editing, setEditing] = useState(false)
  const [inputDraft, setInputDraft] = useState('')

  function saveMicInput() {
    localStorage.setItem('micInputId', inputDraft)
    setMicInputId(inputDraft)
    setEditing(false)
  }

  if (!atemState?.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ATEM Audio Mixer</CardTitle>
          <Badge variant="danger">Offline</Badge>
        </CardHeader>
        <p className="text-xs text-slate-500">ATEM not connected.</p>
      </Card>
    )
  }

  const { audioChannels, audioMixer } = atemState

  return (
    <Card>
      <CardHeader>
        <CardTitle>ATEM Audio Mixer</CardTitle>
        <Badge variant={audioMixer !== 'none' ? 'info' : 'warning'}>
          {audioMixer === 'classic' ? 'Classic' : audioMixer === 'fairlight' ? 'Fairlight' : 'No mixer'}
        </Badge>
      </CardHeader>

      {/* Mic input ID selector */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-slate-500">DJI Mic on ATEM Input:</span>
        {editing ? (
          <>
            <input
              type="number"
              value={inputDraft}
              onChange={(e) => setInputDraft(e.target.value)}
              placeholder="e.g. 7"
              className="w-16 bg-[#0f1117] border border-amber-700 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
            />
            <Button size="sm" onClick={saveMicInput}>Save</Button>
          </>
        ) : (
          <>
            <span className={cn(
              'text-xs font-mono font-bold',
              micInputId ? 'text-amber-400' : 'text-slate-600'
            )}>
              {micInputId || 'not set'}
            </span>
            <Button size="sm" variant="ghost" onClick={() => { setInputDraft(micInputId); setEditing(true) }}>
              {micInputId ? 'Change' : 'Set'}
            </Button>
          </>
        )}
      </div>

      {audioChannels?.length > 0 ? (
        <div className="space-y-2">
          {/* Always show the designated mic input first if set */}
          {audioChannels
            .sort((a, b) => {
              if (String(a.id) === micInputId) return -1
              if (String(b.id) === micInputId) return 1
              return a.id - b.id
            })
            .map((ch) => (
              <ChannelStrip key={ch.id} channel={ch} micInputId={micInputId} />
            ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {audioMixer === 'none'
            ? 'No audio mixer state detected. Check ATEM firmware.'
            : 'No audio channels found.'}
        </p>
      )}
    </Card>
  )
}
