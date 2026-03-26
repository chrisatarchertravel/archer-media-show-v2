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
//
// NOTE: Uses koffi (prebuilt FFI — no native compilation required) instead of
// voicemeeter-connector (which depends on ffi-napi, broken on Node 18+ / VS2026)

const fs = require('fs')

// ─── DLL loader ──────────────────────────────────────────────────────────────

function findVoicemeeterDLL() {
  const candidates = [
    'C:\\Program Files (x86)\\VB\\Voicemeeter\\VoicemeeterRemote64.dll',
    'C:\\Program Files\\VB\\Voicemeeter\\VoicemeeterRemote64.dll',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

let vm = null   // koffi DLL functions
let vmConnected = false

function loadDLL() {
  const dllPath = findVoicemeeterDLL()
  if (!dllPath) {
    console.warn('[Voicemeeter] DLL not found — is Voicemeeter installed?')
    return null
  }

  try {
    const koffi = require('koffi')
    const lib = koffi.load(dllPath)

    return {
      Login:              lib.func('long VBVMR_Login()'),
      Logout:             lib.func('long VBVMR_Logout()'),
      IsParametersDirty:  lib.func('long VBVMR_IsParametersDirty()'),
      GetParameterFloat:  lib.func('long VBVMR_GetParameterFloat(str lpszParamName, _Out_ float *pValue)'),
      SetParameterFloat:  lib.func('long VBVMR_SetParameterFloat(str lpszParamName, float Value)'),
    }
  } catch (err) {
    console.warn('[Voicemeeter] Failed to load DLL:', err.message)
    return null
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

let vmState = {
  connected: false,
  ifbSafeMode: true,
  strips: [
    { id: 0, label: 'DJI Mics',                gain: 0, mute: false, b1: true,  b2: false, a1: true  },
    { id: 1, label: 'Input 2',                  gain: 0, mute: false, b1: false, b2: false, a1: false },
    { id: 2, label: 'Input 3',                  gain: 0, mute: false, b1: false, b2: false, a1: false },
    { id: 3, label: 'Virtual 1 (System Audio)', gain: 0, mute: false, b1: true,  b2: true,  a1: true  },
    { id: 4, label: 'Virtual 2',                gain: 0, mute: false, b1: false, b2: false, a1: false },
  ],
  buses: [
    { id: 0, label: 'A1 (Hardware Out)',       gain: 0, mute: false },
    { id: 1, label: 'A2',                      gain: 0, mute: false },
    { id: 2, label: 'A3',                      gain: 0, mute: false },
    { id: 3, label: 'B1 → OBS (Broadcast)',    gain: 0, mute: false },
    { id: 4, label: 'B2 → IFB Feed',           gain: 0, mute: false },
  ],
}

function getVMState() {
  return { ...vmState, strips: [...vmState.strips], buses: [...vmState.buses] }
}

// ─── Low-level DLL helpers ────────────────────────────────────────────────────

function getFloat(paramName) {
  if (!vm || !vmConnected) return null
  try {
    const out = [0]
    const result = vm.GetParameterFloat(paramName, out)
    return result === 0 ? out[0] : null
  } catch {
    return null
  }
}

function setFloat(paramName, value) {
  if (!vm || !vmConnected) return false
  try {
    return vm.SetParameterFloat(paramName, value) === 0
  } catch {
    return false
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initVoicemeeter(io) {
  vm = loadDLL()

  if (!vm) {
    console.warn('[Voicemeeter] Running in simulation mode')
    return
  }

  try {
    const loginResult = vm.Login()
    // 0 = Voicemeeter running, 1 = launched by us (OK either way), negative = error
    if (loginResult >= 0) {
      vmConnected = true
      vmState.connected = true
      console.log('[Voicemeeter] Connected (login result:', loginResult, ')')
      refreshFromVM()
      if (io) io.emit('vm:state', getVMState())
    } else {
      console.warn('[Voicemeeter] Login failed with code', loginResult, '— is Voicemeeter running?')
    }
  } catch (err) {
    console.warn('[Voicemeeter] Login error:', err.message)
  }
}

function refreshFromVM() {
  if (!vm || !vmConnected) return

  vmState.strips = vmState.strips.map((strip) => {
    const i = strip.id
    return {
      ...strip,
      gain: getFloat(`Strip[${i}].Gain`) ?? strip.gain,
      mute: (getFloat(`Strip[${i}].Mute`) ?? 0) === 1,
      b1:   (getFloat(`Strip[${i}].B1`)   ?? (strip.b1 ? 1 : 0)) === 1,
      b2:   (getFloat(`Strip[${i}].B2`)   ?? (strip.b2 ? 1 : 0)) === 1,
      a1:   (getFloat(`Strip[${i}].A1`)   ?? (strip.a1 ? 1 : 0)) === 1,
    }
  })

  vmState.buses = vmState.buses.map((bus) => {
    const i = bus.id
    return {
      ...bus,
      gain: getFloat(`Bus[${i}].Gain`) ?? bus.gain,
      mute: (getFloat(`Bus[${i}].Mute`) ?? 0) === 1,
    }
  })

  // IFB safe mode = mic strip NOT sending to B2
  vmState.ifbSafeMode = !vmState.strips[0].b2
}

// ─── IFB Safe Mode ────────────────────────────────────────────────────────────

function setIFBSafeMode(enabled) {
  // enabled = true  → mics excluded from IFB (safe for presenters)
  // enabled = false → mics included in IFB (useful for soundcheck)
  const b2Value = enabled ? 0 : 1

  setFloat('Strip[0].B2', b2Value)

  vmState.strips[0] = { ...vmState.strips[0], b2: !enabled }
  vmState.ifbSafeMode = enabled

  return getVMState()
}

// ─── Strip routing ────────────────────────────────────────────────────────────

function setStripRouting(stripId, param, value) {
  const paramName = `Strip[${stripId}].${param.toUpperCase()}`
  setFloat(paramName, value ? 1 : 0)

  const idx = vmState.strips.findIndex((s) => s.id === stripId)
  if (idx !== -1) {
    vmState.strips[idx] = { ...vmState.strips[idx], [param.toLowerCase()]: value }
  }

  vmState.ifbSafeMode = !vmState.strips[0].b2

  return getVMState()
}

// ─── Strip gain ───────────────────────────────────────────────────────────────

function setStripGain(stripId, gain) {
  const clamped = Math.max(-60, Math.min(12, gain))
  setFloat(`Strip[${stripId}].Gain`, clamped)

  const idx = vmState.strips.findIndex((s) => s.id === stripId)
  if (idx !== -1) {
    vmState.strips[idx] = { ...vmState.strips[idx], gain: clamped }
  }

  return getVMState()
}

// ─── Bus gain ─────────────────────────────────────────────────────────────────

function setBusGain(busId, gain) {
  const clamped = Math.max(-60, Math.min(12, gain))
  setFloat(`Bus[${busId}].Gain`, clamped)

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
      setBusGain(4, 0)
      setFloat('Bus[4].Mute', 0)
      vmState.buses[4] = { ...vmState.buses[4], mute: false }
    },
  },
  rehearsal: {
    label: 'Rehearsal',
    description: 'Mics included in IFB — presenters can hear themselves for soundcheck',
    apply: () => {
      setIFBSafeMode(false)
      setBusGain(4, 0)
      setFloat('Bus[4].Mute', 0)
      vmState.buses[4] = { ...vmState.buses[4], mute: false }
    },
  },
  break: {
    label: 'Break Mode',
    description: 'IFB bus muted — presenters hear nothing',
    apply: () => {
      setFloat('Bus[4].Mute', 1)
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
