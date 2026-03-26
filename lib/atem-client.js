const { Atem, AudioMixOption } = require('atem-connection')

// AudioMixOption values: Off = 0, On = 1, AudioFollowVideo = 2

let atem = null
let atemConnected = false
let atemState = {
  connected: false,
  ip: process.env.ATEM_IP || '192.168.10.240',
  programInput: null,
  previewInput: null,
  audioMixer: 'none',   // 'classic' | 'fairlight' | 'none'
  audioChannels: [],
}

function getATEMState() {
  return { ...atemState, audioChannels: [...(atemState.audioChannels || [])] }
}

function initATEM(io) {
  const ip = process.env.ATEM_IP || '192.168.10.240'

  atem = new Atem()

  atem.on('connected', () => {
    console.log('[ATEM] Connected to', ip)
    atemConnected = true
    syncState(null, null, io)
  })

  atem.on('disconnected', () => {
    console.log('[ATEM] Disconnected')
    atemConnected = false
    atemState = { ...atemState, connected: false }
    if (io) io.emit('atem:state', getATEMState())
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
  const me = s.video?.ME?.[0]

  // Detect which audio mixer this ATEM has
  const hasFairlight = !!s.fairlight?.inputs && Object.keys(s.fairlight.inputs).length > 0
  const hasClassic   = !!s.audio?.channels  && Object.keys(s.audio.channels).length > 0
  const mixerType    = hasFairlight ? 'fairlight' : hasClassic ? 'classic' : 'none'

  atemState = {
    connected:     true,
    ip:            process.env.ATEM_IP || '192.168.10.240',
    programInput:  me?.programInput ?? null,
    previewInput:  me?.previewInput ?? null,
    audioMixer:    mixerType,
    audioChannels: buildAudioChannels(s, mixerType),
  }

  if (io) io.emit('atem:state', getATEMState())
}

function buildAudioChannels(s, mixerType) {
  if (mixerType === 'fairlight') {
    return Object.entries(s.fairlight.inputs).map(([id, input]) => ({
      id:        Number(id),
      label:     getInputLabel(s, Number(id)),
      gain:      input?.gain ?? 0,
      mixOption: null,
      muted:     input?.gain === -10000,
      type:      'fairlight',
    }))
  }

  if (mixerType === 'classic') {
    return Object.entries(s.audio.channels).map(([id, ch]) => ({
      id:        Number(id),
      label:     getInputLabel(s, Number(id)),
      // Classic mixer gain is 0–65381, where 32768 = unity (0 dB)
      // Convert to dB for display: dB = 20 * log10(gain / 32768)
      gain:      classicGainToDB(ch?.gain ?? 32768),
      rawGain:   ch?.gain ?? 32768,
      mixOption: ch?.mixOption ?? 0,
      muted:     ch?.mixOption === 0, // 0 = Off in classic mixer
      type:      'classic',
    }))
  }

  return []
}

function getInputLabel(s, inputId) {
  return s.inputs?.[inputId]?.longName ?? `Input ${inputId}`
}

// Classic mixer gain conversion
function classicGainToDB(rawGain) {
  if (rawGain <= 0) return -60
  return Math.round(20 * Math.log10(rawGain / 32768) * 10) / 10
}

function dbToClassicGain(db) {
  if (db <= -60) return 0
  return Math.round(32768 * Math.pow(10, db / 20))
}

// ─── Audio control ────────────────────────────────────────────────────────────
// Controls the dedicated DJI mic input channel on the ATEM audio mixer.
// inputId = the ATEM input number the mic physical connection is wired to.

async function setAudioInputGain(inputId, db) {
  if (!atem || !atemConnected) return { ok: false, error: 'ATEM not connected' }

  try {
    const mixerType = atemState.audioMixer

    if (mixerType === 'classic') {
      const rawGain = dbToClassicGain(db)
      await atem.setClassicAudioMixerInputProps(inputId, { gain: rawGain })
      return { ok: true }
    }

    if (mixerType === 'fairlight') {
      // Fairlight gain is in dBFS * 100 (e.g. 0 dB = 0, -10 dB = -1000)
      await atem.setFairlightAudioMixerInputProperties(inputId, { gain: db * 100 })
      return { ok: true }
    }

    return { ok: false, error: 'No audio mixer detected on this ATEM' }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

async function setAudioInputMixOption(inputId, option) {
  // option: 'on' | 'off' | 'afv'
  if (!atem || !atemConnected) return { ok: false, error: 'ATEM not connected' }

  try {
    const mixerType = atemState.audioMixer

    if (mixerType === 'classic') {
      const mixOption =
        option === 'on'  ? AudioMixOption.On  :
        option === 'afv' ? AudioMixOption.AudioFollowVideo :
                           AudioMixOption.Off

      await atem.setClassicAudioMixerInputProps(inputId, { mixOption })
      return { ok: true }
    }

    return { ok: false, error: 'Mix option control only supported on Classic audio mixer' }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

async function connectATEM(ip) {
  if (atem) await atem.disconnect()
  atemState.ip = ip
  atem.connect(ip)
  return { ok: true }
}

module.exports = {
  initATEM,
  getATEMState,
  setAudioInputGain,
  setAudioInputMixOption,
  connectATEM,
  getAtem: () => atem,
}
