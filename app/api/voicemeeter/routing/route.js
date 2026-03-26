import { NextResponse } from 'next/server'
import { setStripRouting } from '@/lib/voicemeeter-client'

// POST — toggle a strip's bus assignment
// Body: { stripId: 0, param: 'b2', value: false }
export async function POST(req) {
  const { stripId, param, value } = await req.json()

  if (stripId === undefined || !param || value === undefined) {
    return NextResponse.json({ error: 'stripId, param, value required' }, { status: 400 })
  }

  const state = setStripRouting(Number(stripId), param, value)

  if (global.io) global.io.emit('vm:state', state)

  return NextResponse.json({ ok: true, state })
}
