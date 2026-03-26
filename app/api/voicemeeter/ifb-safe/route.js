import { NextResponse } from 'next/server'
import { setIFBSafeMode, getVMState } from '@/lib/voicemeeter-client'

// GET — return current IFB safe mode status
export async function GET() {
  const state = getVMState()
  return NextResponse.json({ ifbSafeMode: state.ifbSafeMode })
}

// POST — set IFB safe mode  { enabled: true | false }
export async function POST(req) {
  const { enabled } = await req.json()
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 })
  }

  const state = setIFBSafeMode(enabled)

  // Broadcast updated state to all connected UI clients
  if (global.io) global.io.emit('vm:state', state)

  return NextResponse.json({ ok: true, ifbSafeMode: state.ifbSafeMode })
}
