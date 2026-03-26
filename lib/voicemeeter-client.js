// ─── Architecture overview ────────────────────────────────────────────────────
//
// Voicemeeter Banana strips:
//   HW Input 1  = DJI Mics (USB-C receiver)
//   HW Input 2  = reserved
//   HW Input 3  = reserved
//   Virtual 1   = All Windows system audio (set as default Windows playback device)
//                 This captures: Zoom, browser, media players, OBS monitoring, etc.
//   Virtual 2   = spare
//
// Voicemeeter Banana buses:
//   A1 = Hardware Out 1  → local monitor/speakers
//   A2 = Hardware Out 2  → physical cable → ATEM XLR input → camera SDI return → presenter IFB
//   A3 = spare
//   B1 = Virtual Cable 1 → OBS audio source → OBS HDMI out → ATEM program input (full mix)
//   B2 = spare (not used in this routing)
//
// DJI Mic strip routing:
//   B1 ON  → mic goes into program mix (via Virtual Cable → OBS → ATEM)
//   A2 OFF → mic does NOT reach the physical IFB output (structural separation, live mode)
//   A2 ON  → mic reaches IFB output (rehearsal only — presenter hears themselves for soundcheck)
//
// System audio strip routing:
//   B1 ON  → system audio goes into program mix (via OBS)
//   A2 ON  → system audio ALSO goes to IFB physical output → presenter hears playback in earpiece
//
// OBS setup:
//   Add "Audio Input Capture" source → select "VB-Audio Virtual Cable" (Voicemeeter B1 output)
//   This is the ONLY audio source in OBS. Desktop Audio in OBS must be DISABLED.
//   OBS sends the mixed audio out via HDMI → HDMI-SDI converter → ATEM program input.
//
// Windows audio setup (required):
//   Set Windows Default Playback Device → "VoiceMeeter Input"
//   All system audio then flows into Voicemeeter Virtual Input 1 automatically.
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
  ifbSafeMode: true,   // true = mics excluded from IFB (A2 bus) — default live state
  strips: [
    // DJI Mics: always go to program (B1/OBS). A2 only ON during rehearsal.
    { id: 0, label: 'DJI Mics',                gain: 0, mute: false, a1: false, a2: false, a3: false, b1: true,  b2: false },
    { id: 1, label: 'Input 2',                  gain: 0, mute: false, a1: false, a2: false, a3: false, b1: false, b2: false },
    { id: 2, label: 'Input 3',                  gain: 0, mute: false, a1: false, a2: false, a3: false, b1: false, b2: false },
    // System audio: goes to program (B1) AND IFB output (A2). Presenters always hear playback.
    { id: 3, label: 'Virtual 1 (System Audio)', gain: 0, mute: false, a1: true,  a2: true,  a3: false, b1: true,  b2: false },
    { id: 4, label: 'Virtual 2',                gain: 0, mute: false, a1: false, a2: false, a3: false, b1: false, b2: false },
  ],
  buses: [
    { id: 0, label: 'A1 (Monitor)',             gain: 0, mute: false },
    { id: 1, label: 'A2 → ATEM XLR (IFB out)', gain: 0, mute: false },
    { id: 2, label: 'A3',                       gain: 0, mute: false },
    { id: 3, label: 'B1 → OBS (Program)',       gain: 0, mute: false },
    { id: 4, label: 'B2',                       gain: 0, mute: false },
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

  // IFB safe = mic strip NOT routing to A2 (IFB physical output)
  vmState.ifbSafeMode = !vmState.strips[0].a2
}

// ─── IFB Safe Mode ────────────────────────────────────────────────────────────
// Controls whether the DJI mic strip sends to A2 (the physical IFB output).
// In live mode (safe=true) mics never reach A2. Presenters hear only system audio.
// In rehearsal mode (safe=false) mics are added to A2 so presenters can hear
// themselves while setting levels.

function setIFBSafeMode(enabled) {
  const a2Value = enabled ? 0 : 1   // 0 = mic excluded from IFB, 1 = mic included

  setFloat('Strip[0].A2', a2Value)

  vmState.strips[0] = { ...vmState.strips[0], a2: !enabled }
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

  vmState.ifbSafeMode = !vmState.strips[0].a2

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
    description: 'Mics in program only — IFB receives system audio only',
    apply: () => {
      // Mic strip: program only, NOT IFB output
      setFloat('Strip[0].B1', 1)
      setFloat('Strip[0].A2', 0)
      vmState.strips[0] = { ...vmState.strips[0], b1: true, a2: false }
      // System audio: both program and IFB output, unmuted
      setFloat('Strip[3].B1', 1)
      setFloat('Strip[3].A2', 1)
      vmState.strips[3] = { ...vmState.strips[3], b1: true, a2: true }
      // IFB physical bus unmuted
      setFloat('Bus[1].Mute', 0)
      vmState.buses[1] = { ...vmState.buses[1], mute: false }
      vmState.ifbSafeMode = true
    },
  },
  rehearsal: {
    label: 'Rehearsal',
    description: 'Mics added to IFB so presenters can hear themselves for soundcheck',
    apply: () => {
      setFloat('Strip[0].B1', 1)
      setFloat('Strip[0].A2', 1)   // mic temporarily in IFB
      vmState.strips[0] = { ...vmState.strips[0], b1: true, a2: true }
      setFloat('Strip[3].B1', 1)
      setFloat('Strip[3].A2', 1)
      vmState.strips[3] = { ...vmState.strips[3], b1: true, a2: true }
      setFloat('Bus[1].Mute', 0)
      vmState.buses[1] = { ...vmState.buses[1], mute: false }
      vmState.ifbSafeMode = false
    },
  },
  break: {
    label: 'Break',
    description: 'IFB output muted — presenters hear nothing',
    apply: () => {
      setFloat('Bus[1].Mute', 1)
      vmState.buses[1] = { ...vmState.buses[1], mute: true }
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
