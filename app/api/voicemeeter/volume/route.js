import { NextResponse } from 'next/server'
import { setStripGain, setBusGain } from '@/lib/voicemeeter-client'

// POST — set strip or bus gain
// Body: { type: 'strip' | 'bus', id: 0, gain: -6 }
export async function POST(req) {
  const { type, id, gain } = await req.json()

  if (!type || id === undefined || gain === undefined) {
    return NextResponse.json({ error: 'type, id, gain required' }, { status: 400 })
  }

  let state
  if (type === 'strip') {
    state = setStripGain(Number(id), Number(gain))
  } else if (type === 'bus') {
    state = setBusGain(Number(id), Number(gain))
  } else {
    return NextResponse.json({ error: 'type must be strip or bus' }, { status: 400 })
  }

  if (global.io) global.io.emit('vm:state', state)

  return NextResponse.json({ ok: true, state })
}
