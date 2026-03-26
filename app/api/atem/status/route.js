import { NextResponse } from 'next/server'
import { getATEMState } from '@/lib/atem-client'

export async function GET() {
  return NextResponse.json(getATEMState())
}
