// Voicemeeter Banana strip/bus layout (updated architecture):
//
// Strips (inputs):
//   0 = Hardware Input 1  (DJI Mics — USB-C)
//   1 = Hardware Input 2  (reserved)
//   2 = Hardware Input 3  (reserved)
//   3 = Virtual Input 1   (System audio / OBS playback)
//   4 = Virtual Input 2   (spare)
//
// Buses (outputs):
//   A1 = Hardware Out 1   (local monitor speakers/headphones)
//   A2 = Hardware Out 2   (→ HDMI-SDI adapter → ATEM dedicated mic input)
//   A3 = Hardware Out 3   (spare)
//   B1 = Virtual Cable 1  (→ OBS → ATEM as computer-audio-only source)
//   B2 = Virtual Cable 2  (→ Physical Out → Wireless IFB TX → Presenter earpieces)
//
// DJI Mic strip routing:
//   A2 ON  → mics go directly to ATEM as a dedicated input (ATEM controls levels)
//   B1 OFF → mics do NOT go into OBS/computer audio mix
//   B2 OFF → mics do NOT reach the IFB feed (IFB safe mode default)
//
// Computer audio strip routing:
//   B1 ON  → goes to OBS → ATEM (music, SFX, playback)
//   B2 ON  → goes to IFB feed (presenters hear program audio in earpiece)
//
// IFB Safe Mode:
//   Mics (Strip 0) have B2 = OFF by default
//   During rehearsal B2 can be toggled ON so presenters hear themselves for soundcheck
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

let vm = null
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
      Login:             lib.func('long VBVMR_Login()'),
      Logout:            lib.func('long VBVMR_Logout()'),
      IsParametersDirty: lib.func('long VBVMR_IsParametersDirty()'),
      GetParameterFloat: lib.func('long VBVMR_GetParameterFloat(str lpszParamName, _Out_ float *pValue)'),
      SetParameterFloat: lib.func('long VBVMR_SetParameterFloat(str lpszParamName, float Value)'),
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
    // DJI mics: routes to A2 (→ ATEM dedicated input), NOT B1 (OBS), NOT B2 (IFB)
    { id: 0, label: 'DJI Mics',                gain: 0, mute: false, a1: false, a2: true,  a3: false, b1: false, b2: false },
    { id: 1, label: 'Input 2',                  gain: 0, mute: false, a1: false, a2: false, a3: false, b1: false, b2: false },
    { id: 2, label: 'Input 3',                  gain: 0, mute: false, a1: false, a2: false, a3: false, b1: false, b2: false },
    // System audio: routes to B1 (OBS broadcast) and B2 (IFB) — no mics mixed in
    { id: 3, label: 'Virtual 1 (System Audio)', gain: 0, mute: false, a1: true,  a2: false, a3: false, b1: true,  b2: true  },
    { id: 4, label: 'Virtual 2',                gain: 0, mute: false, a1: false, a2: false, a3: false, b1: false, b2: false },
  ],
  buses: [
    { id: 0, label: 'A1 (Monitor)',          gain: 0, mute: false },
    { id: 1, label: 'A2 → ATEM Mic Input',   gain: 0, mute: false },
    { id: 2, label: 'A3',                    gain: 0, mute: false },
    { id: 3, label: 'B1 → OBS (Broadcast)',  gain: 0, mute: false },
    { id: 4, label: 'B2 → IFB Feed',         gain: 0, mute: false },
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
      a1:   (getFloat(`Strip[${i}].A1`)   ?? (strip.a1 ? 1 : 0)) === 1,
      a2:   (getFloat(`Strip[${i}].A2`)   ?? (strip.a2 ? 1 : 0)) === 1,
      a3:   (getFloat(`Strip[${i}].A3`)   ?? (strip.a3 ? 1 : 0)) === 1,
      b1:   (getFloat(`Strip[${i}].B1`)   ?? (strip.b1 ? 1 : 0)) === 1,
      b2:   (getFloat(`Strip[${i}].B2`)   ?? (strip.b2 ? 1 : 0)) === 1,
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

  vmState.ifbSafeMode = !vmState.strips[0].b2
}

// ─── IFB Safe Mode ────────────────────────────────────────────────────────────
// Mic strip (0) should never reach B2 (IFB bus) during live show.
// Rehearsal mode can enable it temporarily for soundcheck.

function setIFBSafeMode(enabled) {
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
    description: 'Mics to ATEM only — IFB receives program audio only',
    apply: () => {
      // Mic strip: A2 on (→ ATEM), B1 off, B2 off (safe)
      setFloat('Strip[0].A2', 1)
      setFloat('Strip[0].B1', 0)
      setFloat('Strip[0].B2', 0)
      vmState.strips[0] = { ...vmState.strips[0], a2: true, b1: false, b2: false }
      // Unmute IFB bus
      setFloat('Bus[4].Mute', 0)
      vmState.buses[4] = { ...vmState.buses[4], mute: false }
      vmState.ifbSafeMode = true
    },
  },
  rehearsal: {
    label: 'Rehearsal',
    description: 'Mics in IFB so presenters can hear themselves for soundcheck',
    apply: () => {
      setFloat('Strip[0].A2', 1)
      setFloat('Strip[0].B1', 0)
      setFloat('Strip[0].B2', 1) // mics audible in IFB for soundcheck
      vmState.strips[0] = { ...vmState.strips[0], a2: true, b1: false, b2: true }
      setFloat('Bus[4].Mute', 0)
      vmState.buses[4] = { ...vmState.buses[4], mute: false }
      vmState.ifbSafeMode = false
    },
  },
  break: {
    label: 'Break',
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
