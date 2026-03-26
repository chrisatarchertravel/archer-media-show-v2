const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { initATEM } = require('./lib/atem-client')
const { initVoicemeeter } = require('./lib/voicemeeter-client')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(server, {
    cors: { origin: '*' }
  })

  // Make io globally accessible to API routes
  global.io = io

  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id)

    // Send current state immediately on connect
    const { getATEMState } = require('./lib/atem-client')
    const { getVMState } = require('./lib/voicemeeter-client')
    socket.emit('atem:state', getATEMState())
    socket.emit('vm:state', getVMState())

    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id)
    })
  })

  // Initialize hardware connections
  initATEM(io)
  initVoicemeeter(io)

  const PORT = process.env.PORT || 3000
  server.listen(PORT, () => {
    console.log(`\n> Archer Show Control ready on http://localhost:${PORT}`)
    console.log('> Connecting to ATEM and Voicemeeter...\n')
  })
})
