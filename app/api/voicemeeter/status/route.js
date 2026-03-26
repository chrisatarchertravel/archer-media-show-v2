import { NextResponse } from 'next/server'
import { getVMState } from '@/lib/voicemeeter-client'

export async function GET() {
  return NextResponse.json(getVMState())
}
