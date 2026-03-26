'use client'

import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle } from './ui/card'

// Columns shown in the routing matrix
const BUS_COLUMNS = [
  { param: 'a1', label: 'A1\nMonitor' },
  { param: 'a2', label: 'A2\nATEM Mic' },
  { param: 'b1', label: 'B1\nBroadcast' },
  { param: 'b2', label: 'B2\nIFB' },
]

// Columns that should warn when mic strip (id=0) is active
const WARN_MIC_ON = ['b1', 'b2']

function RoutingCell({ active, warn, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-8 h-8 rounded text-xs font-bold transition-colors focus:outline-none',
        active && warn
          ? 'bg-amber-700 text-amber-200 hover:bg-amber-600 shadow-[0_0_8px_rgba(214,158,46,0.4)]'
          : active
          ? 'bg-green-700 text-green-200 hover:bg-green-600 shadow-[0_0_8px_rgba(56,161,105,0.4)]'
          : 'bg-[#0f1117] text-slate-600 border border-[#2a2d3a] hover:border-slate-500'
      )}
    >
      {active ? '●' : '○'}
    </button>
  )
}

export function AudioRoutingGrid({ strips }) {
  async function toggleRouting(stripId, param, currentValue) {
    await fetch('/api/voicemeeter/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripId, param, value: !currentValue }),
    })
    // State update comes back via socket broadcast from server
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
        <CardTitle>Voicemeeter Routing</CardTitle>
        <p className="text-xs text-slate-500">Strip → Bus</p>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-normal pb-2 pr-4">Input Strip</th>
              {BUS_COLUMNS.map((col) => (
                <th key={col.param} className="text-center text-slate-500 font-normal pb-2 px-2 whitespace-pre-line leading-tight">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d3a]">
            {strips.map((strip) => (
              <tr key={strip.id}>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-medium">{strip.label}</span>
                    {strip.id === 0 && (
                      <span className="text-[10px] text-amber-400 border border-amber-800 rounded px-1">MIC</span>
                    )}
                    {strip.id === 3 && (
                      <span className="text-[10px] text-blue-400 border border-blue-800 rounded px-1">SYS</span>
                    )}
                  </div>
                </td>
                {BUS_COLUMNS.map((col) => (
                  <td key={col.param} className="py-2 px-2 text-center">
                    <div className="flex justify-center">
                      <RoutingCell
                        active={strip[col.param]}
                        warn={strip.id === 0 && WARN_MIC_ON.includes(col.param) && strip[col.param]}
                        onClick={() => toggleRouting(strip.id, col.param, strip[col.param])}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-1 pt-2 border-t border-[#2a2d3a]">
        <p className="text-[10px] text-slate-600">● = active &nbsp;|&nbsp; <span className="text-amber-600">●</span> = active but may cause IFB feedback</p>
        <p className="text-[10px] text-slate-600">MIC strip: A2 → ATEM dedicated input &nbsp;|&nbsp; B1/B2 should stay OFF during live show</p>
      </div>
    </Card>
  )
}
