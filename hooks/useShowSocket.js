'use client'

import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

const initialATEM = {
  connected: false,
  ip: '192.168.10.240',
  programInput: null,
  previewInput: null,
  audioChannels: [],
}

const initialVM = {
  connected: false,
  ifbSafeMode: true,
  strips: [],
  buses: [],
}

export function useShowSocket() {
  const [socketConnected, setSocketConnected] = useState(false)
  const [atemState, setAtemState] = useState(initialATEM)
  const [vmState, setVmState] = useState(initialVM)
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = io({ path: '/socket.io' })
    socketRef.current = socket

    socket.on('connect', () => setSocketConnected(true))
    socket.on('disconnect', () => setSocketConnected(false))
    socket.on('atem:state', (state) => setAtemState(state))
    socket.on('vm:state', (state) => setVmState(state))

    return () => socket.disconnect()
  }, [])

  return { socketConnected, atemState, vmState }
}
