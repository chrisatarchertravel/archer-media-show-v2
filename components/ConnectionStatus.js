'use client'

import { useState } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

function Dot({ connected }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-400 shadow-[0_0_6px_#38a169]' : 'bg-red-500'}`} />
  )
}

export function ConnectionStatus({ atemState, vmState, socketConnected }) {
  const [atemIp, setAtemIp] = useState(atemState?.ip || '192.168.10.240')
  const [reconnecting, setReconnecting] = useState(false)

  async function reconnectATEM() {
    setReconnecting(true)
    await fetch('/api/atem/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: atemIp }),
    })
    setReconnecting(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connections</CardTitle>
        <Badge variant={socketConnected ? 'success' : 'danger'}>
          {socketConnected ? 'Live' : 'Offline'}
        </Badge>
      </CardHeader>

      <div className="space-y-3">
        {/* ATEM */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dot connected={atemState?.connected} />
            <div>
              <p className="text-sm font-medium text-slate-200">ATEM HD8 ISO</p>
              <p className="text-xs text-slate-500">{atemIp}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={atemState?.connected ? 'success' : 'danger'}>
              {atemState?.connected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={reconnectATEM}
              disabled={reconnecting}
              title="Reconnect ATEM"
            >
              <RefreshCw size={13} className={reconnecting ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* ATEM IP input */}
        {!atemState?.connected && (
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={atemIp}
              onChange={(e) => setAtemIp(e.target.value)}
              placeholder="192.168.10.240"
              className="flex-1 bg-[#0f1117] border border-[#2a2d3a] rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-slate-500"
            />
            <Button size="sm" onClick={reconnectATEM} disabled={reconnecting}>
              Connect
            </Button>
          </div>
        )}

        {/* Voicemeeter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dot connected={vmState?.connected} />
            <div>
              <p className="text-sm font-medium text-slate-200">Voicemeeter Banana</p>
              <p className="text-xs text-slate-500">Windows DLL Bridge</p>
            </div>
          </div>
          <Badge variant={vmState?.connected ? 'success' : 'warning'}>
            {vmState?.connected ? 'Connected' : 'Simulation'}
          </Badge>
        </div>
      </div>
    </Card>
  )
}
