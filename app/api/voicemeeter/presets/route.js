import { NextResponse } from 'next/server'
import { applyPreset, getPresets } from '@/lib/voicemeeter-client'

export async function GET() {
  return NextResponse.json(getPresets())
}

export async function POST(req) {
  const { preset } = await req.json()
  if (!preset) return NextResponse.json({ error: 'preset required' }, { status: 400 })

  const result = applyPreset(preset)
  if (!result.ok) return NextResponse.json(result, { status: 400 })

  if (global.io) global.io.emit('vm:state', result.state)

  return NextResponse.json(result)
}
