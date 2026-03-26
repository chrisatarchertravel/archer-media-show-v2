import { NextResponse } from 'next/server'
import { connectATEM, getATEMState } from '@/lib/atem-client'

export async function POST(req) {
  const { ip } = await req.json()
  if (!ip) return NextResponse.json({ error: 'ip required' }, { status: 400 })

  const result = await connectATEM(ip)
  return NextResponse.json(result)
}

export async function GET() {
  return NextResponse.json(getATEMState())
}
