// Voicemeeter Banana strip/bus layout:
//
// Strips (inputs):
//   0 = Hardware Input 1  (DJI Mics — USB-C)
//   1 = Hardware Input 2  (reserved / secondary source)
//   2 = Hardware Input 3  (reserved)
//   3 = Virtual Input 1   (OBS / system audio)
//   4 = Virtual Input 2   (spare)
//
// Buses (outputs):
//   0 = A1 (hardware out — e.g. speakers/headphones)
//   1 = A2 (hardware out)
//   2 = A3 (hardware out)
//   3 = B1 (Virtual Cable 1 → OBS input → ATEM broadcast mix)
//   4 = B2 (Virtual Cable 2 → ATEM aux → Camera Talkback → IFB)
//
// IFB Safe Mode:
//   Strip 0 (mics) sends to B1 (broadcast) ✓
//   Strip 0 (mics) does NOT send to B2 (IFB) ✗  ← this solves the problem

let voicemeeter = null
let vmConnected = false

// Track current routing state in memory for fast reads
let vmState = {
  connected: false,
  ifbSafeMode: true,  // default ON — mics excluded from IFB bus
  strips: [
    { id: 0, label: 'DJI Mics', gain: 0, mute: false, b1: true, b2: false, a1: true },
    { id: 1, label: 'Input 2',  gain: 0, mute: false, b1: false, b2: false, a1: false },
    { id: 2, label: 'Input 3',  gain: 0, mute: false, b1: false, b2: false, a1: false },
    { id: 3, label: 'Virtual 1 (System Audio)', gain: 0, mute: false, b1: true, b2: true, a1: true },
    { id: 4, label: 'Virtual 2', gain: 0, mute: false, b1: false, b2: false, a1: false },
  ],
  buses: [
    { id: 0, label: 'A1 (Hardware Out)', gain: 0, mute: false },
    { id: 1, label: 'A2', gain: 0, mute: false },
    { id: 2, label: 'A3', gain: 0, mute: false },
    { id: 3, label: 'B1 → OBS (Broadcast)', gain: 0, mute: false },
    { id: 4, label: 'B2 → IFB Feed', gain: 0, mute: false },
  ],
}

function getVMState() {
  return { ...vmState, strips: [...vmState.strips], buses: [...vmState.buses] }
}

function initVoicemeeter(io) {
  try {
    const VoicemeeterConnector = require('voicemeeter-connector')
    voicemeeter = VoicemeeterConnector.createInstance()

    voicemeeter.connect(() => {
      console.log('[Voicemeeter] Connected')
      vmConnected = true
      vmState.connected = true

      // Read actual state from Voicemeeter on connect
      refreshFromVM()

      if (io) io.emit('vm:state', getVMState())
    })

    voicemeeter.on('disconnect', () => {
      console.log('[Voicemeeter] Disconnected')
      vmConnected = false
      vmState.connected = false
      if (io) io.emit('vm:state', getVMState())
    })

  } catch (err) {
    console.warn('[Voicemeeter] Could not load voicemeeter-connector:', err.message)
    console.warn('[Voicemeeter] Running in simulation mode')
    vmState.connected = false
    // In dev/simulation mode the app still works with in-memory state
  }
}

function refreshFromVM() {
  if (!voicemeeter || !vmConnected) return

  try {
    vmState.strips = vmState.strips.map((strip) => ({
      ...strip,
      gain:  voicemeeter.getStripParameter(strip.id, 'gain')  ?? strip.gain,
      mute:  voicemeeter.getStripParameter(strip.id, 'mute')  === 1,
      b1:    voicemeeter.getStripParameter(strip.id, 'B1')    === 1,
      b2:    voicemeeter.getStripParameter(strip.id, 'B2')    === 1,
      a1:    voicemeeter.getStripParameter(strip.id, 'A1')    === 1,
    }))

    vmState.buses = vmState.buses.map((bus) => ({
      ...bus,
      gain: voicemeeter.getBusParameter(bus.id, 'gain') ?? bus.gain,
      mute: voicemeeter.getBusParameter(bus.id, 'mute') === 1,
    }))

    // Infer IFB safe mode: if mic strip (0) has B2 = false → safe mode is ON
    vmState.ifbSafeMode = !vmState.strips[0].b2
  } catch (err) {
    console.error('[Voicemeeter] refreshFromVM error:', err.message)
  }
}

// ─── IFB Safe Mode ────────────────────────────────────────────────────────────
// The core feature: toggle mic strip's B2 assignment (IFB bus) on/off
function setIFBSafeMode(enabled) {
  // enabled = true  → mics excluded from IFB (safe for presenters)
  // enabled = false → mics included in IFB (useful for soundcheck)
  const b2Value = enabled ? 0 : 1  // 0 = off, 1 = on

  if (voicemeeter && vmConnected) {
    try {
      // Strip 0 = DJI Mics
      voicemeeter.setStripParameter(0, 'B2', b2Value)
    } catch (err) {
      console.error('[Voicemeeter] setIFBSafeMode error:', err.message)
    }
  }

  // Always update in-memory state (works in simulation too)
  vmState.strips[0] = { ...vmState.strips[0], b2: !enabled }
  vmState.ifbSafeMode = enabled

  return getVMState()
}

// ─── Strip routing ────────────────────────────────────────────────────────────
function setStripRouting(stripId, param, value) {
  if (voicemeeter && vmConnected) {
    try {
      voicemeeter.setStripParameter(stripId, param.toUpperCase(), value ? 1 : 0)
    } catch (err) {
      console.error('[Voicemeeter] setStripRouting error:', err.message)
    }
  }

  const idx = vmState.strips.findIndex((s) => s.id === stripId)
  if (idx !== -1) {
    vmState.strips[idx] = { ...vmState.strips[idx], [param.toLowerCase()]: value }
  }

  // Keep ifbSafeMode in sync
  vmState.ifbSafeMode = !vmState.strips[0].b2

  return getVMState()
}

// ─── Strip gain ───────────────────────────────────────────────────────────────
function setStripGain(stripId, gain) {
  const clamped = Math.max(-60, Math.min(12, gain))

  if (voicemeeter && vmConnected) {
    try {
      voicemeeter.setStripParameter(stripId, 'gain', clamped)
    } catch (err) {
      console.error('[Voicemeeter] setStripGain error:', err.message)
    }
  }

  const idx = vmState.strips.findIndex((s) => s.id === stripId)
  if (idx !== -1) {
    vmState.strips[idx] = { ...vmState.strips[idx], gain: clamped }
  }

  return getVMState()
}

// ─── Bus gain ─────────────────────────────────────────────────────────────────
function setBusGain(busId, gain) {
  const clamped = Math.max(-60, Math.min(12, gain))

  if (voicemeeter && vmConnected) {
    try {
      voicemeeter.setBusParameter(busId, 'gain', clamped)
    } catch (err) {
      console.error('[Voicemeeter] setBusGain error:', err.message)
    }
  }

  const idx = vmState.buses.findIndex((b) => b.id === busId)
  if (idx !== -1) {
    vmState.buses[idx] = { ...vmState.buses[idx], gain: clamped }
  }

  return getVMState()
}

// ─── Presets ──────────────────────────────────────────────────────────────────
const PRESETS = {
  live: {
    label: 'Live Mode',
    description: 'Mics excluded from IFB — presenters hear program only',
    apply: () => {
      setIFBSafeMode(true)
      setBusGain(4, 0) // IFB bus at unity
    },
  },
  rehearsal: {
    label: 'Rehearsal',
    description: 'Mics included in IFB — presenters can hear themselves for soundcheck',
    apply: () => {
      setIFBSafeMode(false)
      setBusGain(4, 0)
    },
  },
  break: {
    label: 'Break Mode',
    description: 'IFB bus muted — presenters hear nothing',
    apply: () => {
      if (voicemeeter && vmConnected) {
        voicemeeter.setBusParameter(4, 'mute', 1)
      }
      vmState.buses[4] = { ...vmState.buses[4], mute: true }
    },
  },
}

function applyPreset(name) {
  const preset = PRESETS[name]
  if (!preset) return { ok: false, error: `Unknown preset: ${name}` }
  preset.apply()
  return { ok: true, state: getVMState() }
}

function getPresets() {
  return Object.entries(PRESETS).map(([key, p]) => ({
    key,
    label: p.label,
    description: p.description,
  }))
}

module.exports = {
  initVoicemeeter,
  getVMState,
  setIFBSafeMode,
  setStripRouting,
  setStripGain,
  setBusGain,
  applyPreset,
  getPresets,
}
