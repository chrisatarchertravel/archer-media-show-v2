'use client'

import { useShowSocket } from '@/hooks/useShowSocket'
import { IFBSafeToggle } from '@/components/IFBSafeToggle'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { AudioRoutingGrid } from '@/components/AudioRoutingGrid'
import { BusVolumePanel } from '@/components/BusVolumeSlider'
import { PresetPanel } from '@/components/PresetPanel'
import { ATEMStatus } from '@/components/ATEMStatus'
import { Radio } from 'lucide-react'

export default function Dashboard() {
  const { socketConnected, atemState, vmState } = useShowSocket()

  return (
    <div className="min-h-screen bg-[#0f1117] p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2d3a]">
        <div className="flex items-center gap-3">
          <Radio size={20} className="text-red-500" />
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-wide">Archer Show Control</h1>
            <p className="text-xs text-slate-500">Live Podcast Audio Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-400 shadow-[0_0_6px_#38a169]' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-500">{socketConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </header>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT — IFB Safe Toggle (hero control, most important) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <IFBSafeToggle ifbSafeMode={vmState?.ifbSafeMode} />
          <PresetPanel />
        </div>

        {/* CENTER — Routing + Levels */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <AudioRoutingGrid strips={vmState?.strips} />
          <BusVolumePanel strips={vmState?.strips} buses={vmState?.buses} />
        </div>

        {/* RIGHT — Hardware status */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <ConnectionStatus
            atemState={atemState}
            vmState={vmState}
            socketConnected={socketConnected}
          />
          <ATEMStatus atemState={atemState} />
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-[#2a2d3a] text-center">
        <p className="text-[10px] text-slate-600">
          B2 bus → ATEM Aux → Camera Talkback → IFB &nbsp;|&nbsp;
          B1 bus → Virtual Cable → OBS → ATEM Broadcast
        </p>
      </footer>
    </div>
  )
}
