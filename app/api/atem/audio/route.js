import { NextResponse } from 'next/server'
import { setAudioInputGain, setAudioInputMixOption, getATEMState } from '@/lib/atem-client'

// GET — return current audio channels
export async function GET() {
  const state = getATEMState()
  return NextResponse.json({
    audioMixer: state.audioMixer,
    audioChannels: state.audioChannels,
  })
}

// POST — control a specific ATEM audio input channel
// Body: { inputId: 7, action: 'gain', value: -6 }
//   or: { inputId: 7, action: 'mixOption', value: 'on' | 'off' | 'afv' }
export async function POST(req) {
  const { inputId, action, value } = await req.json()

  if (!inputId || !action || value === undefined) {
    return NextResponse.json({ error: 'inputId, action, value required' }, { status: 400 })
  }

  let result
  if (action === 'gain') {
    result = await setAudioInputGain(Number(inputId), Number(value))
  } else if (action === 'mixOption') {
    result = await setAudioInputMixOption(Number(inputId), value)
  } else {
    return NextResponse.json({ error: 'action must be gain or mixOption' }, { status: 400 })
  }

  if (!result.ok) return NextResponse.json(result, { status: 500 })

  const state = getATEMState()
  if (global.io) global.io.emit('atem:state', state)

  return NextResponse.json({ ok: true })
}
