const { Atem } = require('atem-connection')

let atem = null
let atemConnected = false
let atemState = {
  connected: false,
  ip: process.env.ATEM_IP || '192.168.10.240',
  programInput: null,
  previewInput: null,
  audioChannels: [],
}

function getATEMState() {
  return { ...atemState }
}

function initATEM(io) {
  const ip = process.env.ATEM_IP || '192.168.10.240'

  atem = new Atem()

  atem.on('connected', () => {
    console.log('[ATEM] Connected to', ip)
    atemConnected = true
    syncState()
  })

  atem.on('disconnected', () => {
    console.log('[ATEM] Disconnected')
    atemConnected = false
    atemState = { ...atemState, connected: false }
    io.emit('atem:state', getATEMState())
  })

  atem.on('stateChanged', (state, pathKeys) => {
    syncState(state, pathKeys, io)
  })

  atem.on('error', (err) => {
    console.error('[ATEM] Error:', err.message)
  })

  console.log('[ATEM] Connecting to', ip)
  atem.connect(ip)
}

function syncState(state, pathKeys, io) {
  if (!atem?.state) return

  const s = atem.state

  // Program / preview inputs on ME1
  const me = s.video?.ME?.[0]
  atemState = {
    connected: true,
    ip: process.env.ATEM_IP || '192.168.10.240',
    programInput: me?.programInput ?? null,
    previewInput: me?.previewInput ?? null,
    audioChannels: buildAudioChannels(s),
  }

  if (io) io.emit('atem:state', getATEMState())
}

function buildAudioChannels(s) {
  const channels = []
  const audioMixers = s.fairlight?.inputs

  if (!audioMixers) return channels

  for (const [inputId, input] of Object.entries(audioMixers)) {
    channels.push({
      id: inputId,
      label: getInputLabel(s, Number(inputId)),
      faderGain: input?.gain ?? 0,
      muted: input?.gain === -10000, // ATEM uses -10000 for silence
    })
  }

  return channels
}

function getInputLabel(s, inputId) {
  return s.inputs?.[inputId]?.longName ?? `Input ${inputId}`
}

async function setATEMAudioGain(inputId, gain) {
  if (!atem || !atemConnected) return { ok: false, error: 'ATEM not connected' }
  try {
    await atem.setFairlightAudioMixerInputProperties(inputId, { gain })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

async function connectATEM(ip) {
  if (atem) {
    await atem.disconnect()
  }
  atemState.ip = ip
  atem.connect(ip)
  return { ok: true }
}

module.exports = {
  initATEM,
  getATEMState,
  setATEMAudioGain,
  connectATEM,
  getAtem: () => atem,
}
