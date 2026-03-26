# Archer Show Control

A local audio control panel for the Archer live podcast show. Built to solve a specific IFB monitoring problem in a Blackmagic-based broadcast setup.

---

## The Problem

The show runs a live podcast using the following signal chain:

- **Blackmagic ATEM Television Studio HD8 ISO** — vision and audio switcher
- **Blackmagic Studio 4K Plus cameras** — with camera control and talkback over SDI
- **DJI Mic 3** — presenter wireless microphones, received via USB-C into the show computer
- **OBS** — running on the show computer, connected to the ATEM via HDMI-to-SDI converter
- **IFBs** — presenter earpieces for program monitoring
- **ATEM talkback** — already in use by the control room team, not available for presenter IFBs

**The issue:** presenters wearing IFBs were hearing their own voices echoing back in their earpieces. This happens because:

1. DJI mics feed into the computer as a single combined audio input
2. The computer sends that audio to OBS, which sends it to the ATEM as one combined source (mics + computer audio mixed together)
3. The ATEM's program output — which includes the presenters' voices — fed back into the presenter IFB system
4. The presenter hears a delayed version of their own voice, which is disorienting

Two constraints made a standard fix impossible:
- A hardware **mix-minus** at the ATEM level is not possible because all mics arrive as a single combined source — individual voices cannot be separated at the switcher
- **ATEM talkback** is already dedicated to the control room team and cannot be repurposed for presenter IFBs

---

## The Solution

Intercept the audio **before it reaches the ATEM** using Voicemeeter Banana and split it into three independent output buses. The key insight is to give the DJI mics their own dedicated physical path to the ATEM — separate from the computer audio — so the ATEM can govern mic levels independently, and the IFB feed can be constructed without any mic signal in it at all.

```
DJI Mics (USB-C)
    │
    ▼
Voicemeeter Banana
    └── Bus A2 ──► Physical Audio Out ──► HDMI-SDI adapter ──► ATEM dedicated mic input
                                                                 (ATEM controls mic levels)

Computer Playback (music, SFX, system audio)
    │
    ▼
Voicemeeter Banana
    ├── Bus B1 ──► Virtual Cable 1 ──► OBS ──► ATEM (computer audio only, no mics)
    └── Bus B2 ──► Physical Audio Out 2 ──► Wireless IFB TX ──► Presenter earpieces ✓
```

This gives the ATEM two independent, controllable audio inputs:
1. **Dedicated mic input** (via A2 physical routing) — level and mix option controlled from ATEM Software Control or this app
2. **Computer audio input** (via OBS/virtual cable) — music, SFX, playback with no mic signal

The presenter IFB feed (B2 bus) only ever contains computer playback audio. Mics never reach it. **IFB Safe Mode** in this app enforces that with one button, and can be temporarily disabled during rehearsal/soundcheck so presenters can hear themselves while setting levels.

---

## Architecture

### Why a custom server alongside Next.js

Next.js API routes are stateless — they spin up per request and cannot hold persistent connections. This app needs two long-lived connections that must stay open for the duration of the show:

- **ATEM connection** — communicates over UDP using the ATEM SDK. Must remain connected to receive state change events from the switcher.
- **Voicemeeter connection** — calls a native Windows DLL (`VoicemeeterRemote64.dll`). The DLL must be loaded once into a persistent Node.js process; it cannot be called from a serverless context.

The solution is `server.js` — a custom Node.js HTTP server that wraps Next.js. It initialises both hardware connections at startup and keeps them alive. Next.js handles routing and the UI as normal; the API routes read and write to module-level singletons that `server.js` owns.

Socket.io is attached to the same HTTP server so that hardware state changes (ATEM switching, Voicemeeter updates) are pushed to the browser in real time without polling.

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server + client in one project, file-based routing for API endpoints |
| Custom server | Node.js + `server.js` | Persistent hardware connections, socket.io attachment |
| Real-time | Socket.io | Push ATEM and Voicemeeter state changes to the UI instantly |
| ATEM control | `atem-connection` | Mature community SDK for ATEM switchers over UDP |
| Voicemeeter control | `voicemeeter-connector` | Wraps the official Voicemeeter Remote DLL for Node.js |
| UI | React (via Next.js) + Tailwind CSS | Component-based UI, utility CSS for a fast broadcast-style dark theme |
| UI primitives | Radix UI + custom shadcn-style components | Accessible, unstyled primitives with full visual control |

### Key Files

```
server.js                          Custom Node server — boots hardware connections and socket.io
lib/
  atem-client.js                   ATEM singleton: connect, state sync, Fairlight audio control
  voicemeeter-client.js            Voicemeeter singleton: IFB safe mode, routing, gain, presets
hooks/
  useShowSocket.js                 Client-side socket hook — all real-time UI state flows here
app/
  page.js                          Main dashboard
  api/voicemeeter/ifb-safe/        POST to toggle IFB safe mode (the core endpoint)
  api/voicemeeter/routing/         POST to toggle individual strip → bus assignments
  api/voicemeeter/volume/          POST to set strip or bus gain
  api/voicemeeter/presets/         GET available presets, POST to apply one
  api/atem/connect/                POST to connect/reconnect to ATEM at a given IP
  api/atem/status/                 GET current switcher state
components/
  IFBSafeToggle.js                 The main on-screen control — one button to fix the IFB problem
  AudioRoutingGrid.js              Visual matrix of all strip → bus routing assignments
  BusVolumeSlider.js               Gain sliders for input strips and output buses
  PresetPanel.js                   One-click show presets (Live, Rehearsal, Break)
  ConnectionStatus.js              ATEM and Voicemeeter connection status with reconnect control
  ATEMStatus.js                    Program/preview input display and Fairlight channel overview
```

---

## Prerequisites

- **Windows 10 or 11** — Voicemeeter and its DLL are Windows-only
- **Windows 10 or 11**
- **Node.js 18+** — install with native build tools (see Installation below)
- **Voicemeeter Banana** — [vb-audio.com/Voicemeeter/banana.htm](https://vb-audio.com/Voicemeeter/banana.htm) (free)
- **VB-Audio Virtual Cable** — [vb-audio.com/Cable](https://vb-audio.com/Cable) (free) — provides the virtual audio cables used as B1 and B2 outputs
- The show computer must be on the **same local network** as the ATEM switcher

---

## Installation

### 1. Install Node.js with native build tools

`voicemeeter-connector` wraps a native Windows DLL and must be compiled for your Node.js version on install. This requires Python and Visual Studio C++ Build Tools.

**Recommended:** Download the Node.js LTS installer from [nodejs.org](https://nodejs.org). During installation, check the box labelled **"Automatically install the necessary tools"**. A PowerShell window will open after Node installs and set up Python and VS Build Tools via Chocolatey — let it complete fully before continuing.

> Do **not** use `npm install -g windows-build-tools` — that package is deprecated and broken on Node 18+.

If you already have Node.js installed and need to add build tools manually, run the following in **PowerShell as Administrator**:

```powershell
choco install python visualstudio2022-workload-vctools -y
```

If Chocolatey is not installed:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### 2. Install project dependencies

```bash
git clone <repo>
cd archer-media-show-v2
npm install
```

---

## Configuration

### 1. Environment variables

Edit `.env.local` in the project root:

```env
# IP address of your ATEM switcher on your local network
# The ATEM default is 192.168.10.240 — confirm yours in ATEM Software Control
ATEM_IP=192.168.10.240

# Port the control panel runs on (default 3000)
PORT=3000
```

To find the ATEM's IP: open **ATEM Software Control → Preferences → Network**. It is displayed there.

---

### 2. Additional hardware required

- **One physical audio output** on the show computer — either the built-in headphone/line-out jack or a USB audio interface output. This carries the IFB feed (system audio only) from Voicemeeter A2 to the ATEM.
- **A 3.5mm TRS to dual XLR cable** (or a DI box) to connect the computer audio output to the ATEM's XLR inputs on the rear panel.

> The ATEM Television Studio HD8 ISO has two XLR audio inputs on the rear panel labelled **Audio In 1** and **Audio In 2**. These accept mic or line-level signal and appear as dedicated audio channels in the ATEM audio mixer. This is the physical path for the IFB feed.

---

### 3. Windows audio setup (do this first)

This step is what separates system audio from the DJI mic inside Voicemeeter. Without it, everything arrives at Voicemeeter on the same strip.

1. Right-click the speaker icon in the Windows taskbar → **Sound settings** (or open Settings → System → Sound)
2. Under **Output**, set the default output device to **VoiceMeeter Input**
3. That's it. All Windows application audio — Zoom, browser, media players, everything — now flows into Voicemeeter as Virtual Input 1, completely separate from the DJI mic which arrives as Hardware Input 1

> If you have Zoom or any conferencing app open, you may also need to go into that app's audio settings and set its speaker/output to **VoiceMeeter Input** explicitly, as some apps cache the device setting.

---

### 4. Voicemeeter Banana setup

Open Voicemeeter Banana. If it is not already open the app will start in simulation mode — open it before launching the show control app.

#### Step 1 — Set Hardware Input 1 to your DJI mic

1. Click the first hardware input dropdown (top-left of the Voicemeeter window)
2. Select your DJI USB-C receiver from the list — it will appear as something like **DJI Wireless Mic Receiver** or similar
3. On that strip, enable **only B1** — press the B1 button so it lights up, make sure A1, A2, A3, B2 are all off

This routes the mic exclusively into the B1 virtual cable, which is what OBS captures. The mic never touches A2 (IFB output) in this state — that is the live default.

#### Step 2 — Confirm Virtual Input 1 routing

The Voicemeeter VAIO strip (Virtual Input 1) is where all Windows system audio arrives after Step 3 above.

On that strip, enable **A1, A2, and B1**:
- A1 = local monitor playback so you can hear the mix in the control room
- A2 = IFB physical output → ATEM XLR → camera SDI return → presenter earpiece
- B1 = into the virtual cable → OBS → ATEM program

#### Step 3 — Set hardware outputs

On the right side of Voicemeeter:

| Output | Select this device | Purpose |
|---|---|---|
| **A1** | Your monitor speakers or headphones | Control room monitoring |
| **A2** | The physical audio output going to the ATEM XLR input (e.g. your headphone jack, or a USB audio interface output) | IFB feed to ATEM |
| **B1** | VB-Audio Virtual Cable | Source for OBS audio |

#### Step 4 — Confirm VB-Audio Virtual Cable is installed

B1 requires VB-Audio Virtual Cable to be installed. Download it from [vb-audio.com/Cable](https://vb-audio.com/Cable). After installing, reboot, then it will appear as a device option in the B1 dropdown.

---

### 5. OBS setup

OBS does not generate audio in this setup — it only packages the Voicemeeter mix and sends it to the ATEM via HDMI.

1. Open OBS → **Settings → Audio**
2. Set **Desktop Audio** to **Disabled**
3. Set **Mic/Auxiliary Audio** to **Disabled**
4. Click OK
5. In the **Sources** panel, click **+** → **Audio Input Capture**
6. Name it "Voicemeeter Mix" → OK
7. In the device dropdown, select **VB-Audio Virtual Cable**
8. Click OK

> OBS now receives the complete Voicemeeter B1 mix (DJI mic + system audio) through the virtual cable and sends it via HDMI to the ATEM. This is your ATEM program audio source. Do not add any other audio sources in OBS — they will double-capture.

---

### 6. Physical wiring

```
Computer headphone/line-out (Voicemeeter A2)
    │
    ▼ 3.5mm TRS → dual XLR cable (or DI box)
    │
    ▼
ATEM Television Studio HD8 ISO — rear panel Audio In 1 (XLR)
    │
    ▼ (configured in ATEM Software Control — see next step)
    │
    ▼
Camera SDI return → Studio 4K Plus headset output → Presenter IFB
```

---

### 7. ATEM Software Control setup

This routes the XLR input (IFB feed) to the camera SDI return so it reaches the presenter headsets.

#### Step 1 — Confirm the XLR input is active in the audio mixer

1. Open **ATEM Software Control**
2. Click the **Audio** tab (top navigation bar)
3. Find the channel labelled **XLR** or **Audio In 1** — this is the IFB feed coming from Voicemeeter A2
4. Set its mix option to **ON** (the button should be lit/active)
5. Set the fader to 0 dB (unity)

#### Step 2 — Route the XLR input to the camera SDI return

This tells the camera what audio to send to the presenter headset.

1. In ATEM Software Control, click the **gear/settings icon** (top right) or go to **Outputs**
2. Look for a section called **SDI Out**, **Return Source**, or **Camera Control** (exact label depends on firmware version)
3. For each Studio 4K Plus camera, find its **Return Source** or **SDI Out Source** dropdown
4. Set it to **XLR** or **Audio In 1** (whichever label your version uses for the rear XLR input)
5. The presenter headset plugged into that camera will now receive the IFB mix — system audio only, no mic feedback

> If you do not see a Return Source option in your current firmware, open **ATEM Setup** (the separate utility, not ATEM Software Control), go to **Software Update**, and install the latest available firmware. Return source routing was added in firmware 8.6.

---

### 8. Running the app

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Open `http://localhost:3000` in a browser on the show computer.

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Open `http://localhost:3000` in a browser on the show computer.

---

## Show Presets

The app includes three one-click presets accessible from the Presets panel:

| Preset | What it does | When to use |
|---|---|---|
| **Live Mode** | Mics go to program only (B1 → OBS → ATEM). IFB receives system audio only (A2). Presenter never hears their own voice. | Default for all live recording |
| **Rehearsal** | Mics added to A2 bus so presenters hear themselves in the IFB alongside system audio. Program output unchanged. | Soundcheck and mic level setting before recording |
| **Break** | A2 bus (IFB physical output) muted. Presenters hear nothing. Program output unchanged. | Ad breaks, between segments |

---

## Simulation Mode

If Voicemeeter is not running or the DLL is not found, the app starts in **simulation mode**. All controls are fully functional and state is tracked in memory — no errors, no crashes. The Connections panel will show `Simulation` instead of `Connected` next to Voicemeeter. This is useful for UI development or testing the app on a machine without Voicemeeter installed.
