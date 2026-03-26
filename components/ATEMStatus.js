'use client'

import { Monitor, Video } from 'lucide-react'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'

export function ATEMStatus({ atemState }) {
  if (!atemState?.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ATEM Switcher</CardTitle>
          <Badge variant="danger">Offline</Badge>
        </CardHeader>
        <p className="text-xs text-slate-500">Not connected. Check IP and network.</p>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ATEM Switcher</CardTitle>
        <Badge variant="success">Live</Badge>
      </CardHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0f1117] rounded p-3">
          <p className="label-xs mb-1">Program</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#e53e3e]" />
            <span className="text-sm font-semibold text-red-300">
              {atemState.programInput != null ? `Input ${atemState.programInput}` : '—'}
            </span>
          </div>
        </div>

        <div className="bg-[#0f1117] rounded p-3">
          <p className="label-xs mb-1">Preview</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-semibold text-green-300">
              {atemState.previewInput != null ? `Input ${atemState.previewInput}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {atemState.audioChannels?.length > 0 && (
        <div className="mt-3">
          <p className="label-xs mb-2">Fairlight Channels</p>
          <div className="space-y-1">
            {atemState.audioChannels.slice(0, 4).map((ch) => (
              <div key={ch.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{ch.label}</span>
                <span className={ch.muted ? 'text-red-500' : 'text-slate-300'}>
                  {ch.muted ? 'MUTED' : `${ch.faderGain} dB`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
