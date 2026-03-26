'use client'

import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle } from './ui/card'

const BUS_LABELS = {
  b1: 'B1\nBroadcast',
  b2: 'B2\nIFB',
  a1: 'A1\nMonitor',
}

function RoutingCell({ active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-8 h-8 rounded text-xs font-bold transition-colors focus:outline-none',
        'disabled:cursor-not-allowed',
        active
          ? 'bg-green-700 text-green-200 hover:bg-green-600 shadow-[0_0_8px_rgba(56,161,105,0.4)]'
          : 'bg-[#0f1117] text-slate-600 border border-[#2a2d3a] hover:border-slate-500'
      )}
    >
      {active ? '●' : '○'}
    </button>
  )
}

export function AudioRoutingGrid({ strips, onRoutingChange }) {
  async function toggleRouting(stripId, param, currentValue) {
    const newValue = !currentValue
    // Optimistic update handled by socket broadcast from server
    await fetch('/api/voicemeeter/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripId, param, value: newValue }),
    })
    if (onRoutingChange) onRoutingChange()
  }

  if (!strips?.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Audio Routing Matrix</CardTitle></CardHeader>
        <p className="text-xs text-slate-500">Waiting for Voicemeeter...</p>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audio Routing Matrix</CardTitle>
        <p className="text-xs text-slate-500">Strip → Bus assignments</p>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-normal pb-2 pr-4 whitespace-nowrap">Input Strip</th>
              {Object.values(BUS_LABELS).map((label) => (
                <th key={label} className="text-center text-slate-500 font-normal pb-2 px-2 whitespace-pre-line leading-tight">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d3a]">
            {strips.map((strip) => (
              <tr key={strip.id}>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <div>
                    <span className="text-slate-200 font-medium">{strip.label}</span>
                    {strip.id === 0 && (
                      <span className="ml-2 text-[10px] text-amber-500 border border-amber-800 rounded px-1">MIC</span>
                    )}
                  </div>
                </td>
                {Object.keys(BUS_LABELS).map((busParam) => (
                  <td key={busParam} className="py-2 px-2 text-center">
                    <div className="flex justify-center">
                      <RoutingCell
                        active={strip[busParam]}
                        onClick={() => toggleRouting(strip.id, busParam, strip[busParam])}
                        // Warn visually if mic is being routed to IFB
                        disabled={false}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-slate-600">
        ● = active routing &nbsp;|&nbsp; B2 IFB column should be OFF for mic strips during live show
      </p>
    </Card>
  )
}
