# Archer Show Control

A local audio control panel for the Archer live podcast show. Built to solve a specific IFB monitoring problem in a Blackmagic-based broadcast setup.

---

## The Problem

The show runs a live podcast using the following signal chain:

- **Blackmagic ATEM Television Studio HD8 ISO** — vision and audio switcher
- **Blackmagic Studio 4K Plus cameras** — with camera control and talkback over SDI
- **DJI Mic 3** — presenter wireless microphones, received via USB-C into the show computer
- **OBS** — running on the show computer, connected to the ATEM via HDMI-to-SDI converter
- **IFBs** — presenter earpieces fed from the Studio 4K Plus's camera talkback feature

**The issue:** presenters wearing IFBs were hearing their own voices echoing back in their earpieces. This happens because:

1. DJI mics feed into the computer as a single combined audio input
2. The computer sends that audio to OBS, which sends it to the ATEM as a program source
3. The ATEM's program output — which now includes the presenters' voices — feeds back into the camera talkback system
4. Camera talkback drives the IFBs, completing the loop

A traditional **mix-minus** (sending each presenter a mix of everything except their own mic) is not possible here because all microphones arrive at the ATEM as one combined source. There is no way to isolate individual voices at the switcher level.

---

## The Solution

Intercept the audio **before it reaches the ATEM** using Voicemeeter Banana, and split it into two separate output buses:

```
DJI Mics (USB-C)
    │
    ▼
Voicemeeter Banana
    ├── Bus B1 ──► Virtual Cable 1 ──► OBS ──► ATEM (full broadcast mix)
    └── Bus B2 ──► Physical Audio Out ──► ATEM Aux Input ──► Camera Talkback ──► IFB

Computer Playback (music, SFX, system audio)
    │
    ▼
Voicemeeter Banana
    ├── Bus B1 ──► OBS (included in broadcast)
    └── Bus B2 ──► IFB feed ✓ (presenters hear this)
```

**IFB Safe Mode** (the core feature of this app) removes the mic strip's B2 routing assignment with one button press. Presenters hear all computer playback audio in their earpieces, but never hear their own voices fed back through the program output.

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
- **Node.js 18+**
- **Voicemeeter Banana** — [vb-audio.com/Voicemeeter/banana.htm](https://vb-audio.com/Voicemeeter/banana.htm) (free)
- **VB-Audio Virtual Cable** — [vb-audio.com/Cable](https://vb-audio.com/Cable) (free) — provides the virtual audio cables used as B1 and B2 outputs
- The show computer must be on the **same local network** as the ATEM switcher

---

## Installation

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

### 2. Voicemeeter Banana setup

Open Voicemeeter Banana before starting the app. Configure it as follows:

#### Hardware Inputs (left side strips)
| Strip | Source | Sends to |
|---|---|---|
| Hardware Input 1 | DJI Mics (select your DJI USB-C device from the dropdown) | B1 ON, B2 OFF, A1 ON |
| Virtual Input 1 | System audio / OBS returns (if needed) | B1 ON, B2 ON, A1 ON |

The critical setting: **Hardware Input 1 (DJI Mics) must have B2 turned OFF**. This is what IFB Safe Mode enforces via the app. B2 is the IFB feed bus — mic audio must never reach it during a live show.

#### Hardware Outputs (right side buses)
| Bus | Route to |
|---|---|
| A1 | Your monitor speakers or headphones (local playback) |
| B1 (Virtual Output 1) | Set as the audio input device in OBS. This is what OBS captures and sends to the ATEM. |
| B2 (Virtual Output 2) | Connect to a physical audio output on your sound card, then wire that output to an available input on the ATEM (used as the IFB source). |

#### In OBS
- Set audio capture device to **VB-Audio Virtual Cable** (which is Bus B1)
- This sends the full broadcast mix (including mics) to the ATEM as a program source

#### On the ATEM
- Route the physical audio input connected to B2 into the **camera talkback / IFB send** for the Studio 4K Plus cameras
- This is done in ATEM Software Control under **Audio → Fairlight** or in the camera control settings

---

### 3. Running the app

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
| **Live Mode** | IFB Safe ON — mics excluded from IFB bus | Default for all live recording |
| **Rehearsal** | IFB Safe OFF — mics included in IFB | Soundcheck, mic testing, before recording |
| **Break** | IFB bus muted entirely | Ad breaks, between segments |

---

## Simulation Mode

If Voicemeeter is not running or the DLL is not found, the app starts in **simulation mode**. All controls are fully functional and state is tracked in memory — no errors, no crashes. The Connections panel will show `Simulation` instead of `Connected` next to Voicemeeter. This is useful for UI development or testing the app on a machine without Voicemeeter installed.
