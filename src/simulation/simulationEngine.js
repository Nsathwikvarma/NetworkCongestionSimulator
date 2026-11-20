// High Performance Discrete-Event Network & Congestion Simulation Engine

import { ALGORITHMS, FlowController, RouterQueue } from './congestionAlgorithms'
import { TOPOLOGIES } from './networkTopology'

export class SimulationEngine {
  constructor(topologyKey = 'SPINE_LEAF_ENTERPRISE', algorithmKey = 'RENO', options = {}) {
    this.topologyKey = topologyKey
    this.algorithmKey = algorithmKey
    this.options = options

    // Simulation Clock
    this.simTimeMs = 0
    this.realDeltaMs = 0
    this.isRunning = false
    this.speed = 1.0 // 0.25x to 5x
    this.tickInterval = null

    // Network Topology State
    this.topology = JSON.parse(JSON.stringify(TOPOLOGIES[topologyKey] || TOPOLOGIES.SPINE_LEAF_ENTERPRISE))
    this.nodeMap = new Map()
    this.linkMap = new Map()
    this.routerQueues = new Map()

    // Variable IP / Node Stats Matrix
    this.nodeIpStats = new Map() // nodeId -> { interfaces: [], ipCounters: { [ip]: { inPkts, outPkts, inBytes, outBytes, drops } } }

    // Congestion Control Flows (Source hosts)
    this.flows = new Map() // flowId -> FlowController

    // In-Flight Packets & Animated Dropped Particles
    this.packets = [] // Active in transit or queued
    this.droppedParticles = [] // Visual explosion effects
    this.nextPacketId = 1

    // Global Telemetry Log for Charts & Reporting
    this.telemetryHistory = []
    this.maxHistoryPoints = 300
    this.lastTelemetrySampleTime = 0
    this.lastTelemetrySampleRealTime = Date.now()
    this.startTimeReal = Date.now()

    // Dynamic Bottleneck Tuning
    this.bottleneckBw = options.bottleneckBw || 16 // Mbps
    this.bottleneckDelay = options.bottleneckDelay || 25 // ms
    this.bottleneckBuffer = options.bottleneckBuffer || 22 // packets
    this.queuePolicy = options.queuePolicy || 'TAIL_DROP' // 'TAIL_DROP' or 'RED'
    this.randomLossRate = options.randomLossRate || 0 // 0 - 5%

    // Callbacks
    this.onTickListeners = new Set()

    this.initTopology()
  }

  initTopology() {
    this.nodeMap.clear()
    this.linkMap.clear()
    this.routerQueues.clear()
    this.nodeIpStats.clear()
    this.flows.clear()
    this.packets = []
    this.droppedParticles = []
    this.telemetryHistory = []
    this.simTimeMs = 0
    this.lastTelemetrySampleTime = 0
    this.lastTelemetrySampleRealTime = Date.now()
    this.startTimeReal = Date.now()

    // Initialize Nodes
    this.topology.nodes.forEach(node => {
      this.nodeMap.set(node.id, node)

      // Initialize Router Queue for intermediate nodes
      if (node.type === 'router' || node.type === 'switch') {
        const capacity = node.isBottleneck ? this.bottleneckBuffer : (node.bufferSize || 30)
        this.routerQueues.set(node.id, new RouterQueue(node.id, capacity, this.queuePolicy))
      }

      // Initialize Node IP Stats & Interface table
      this.nodeIpStats.set(node.id, {
        nodeId: node.id,
        nodeName: node.name,
        primaryIp: node.ip,
        subnet: node.subnet,
        type: node.type,
        ipCounters: {},
        totalInPkts: 0,
        totalOutPkts: 0,
        totalInBytes: 0,
        totalOutBytes: 0,
        totalDrops: 0,
        recentForwardingLog: []
      })
    })

    // Initialize Links
    this.topology.links.forEach(link => {
      if (link.isBottleneckLink) {
        link.bandwidth = this.bottleneckBw
        link.delay = this.bottleneckDelay
      }
      this.linkMap.set(link.id, link)
    })

    // Initialize Congestion Control Flows on Active Host Nodes
    const activeHosts = this.topology.nodes.filter(n => n.type === 'host' && n.active !== false)
    const serverNodes = this.topology.nodes.filter(n => n.type === 'server')

    activeHosts.forEach((host, idx) => {
      const destServer = serverNodes[idx % serverNodes.length] || serverNodes[0]
      const controller = new FlowController(host.id, this.algorithmKey, this.options)
      controller.destServerId = destServer.id
      controller.destServerIp = destServer.ip
      controller.flowColor = host.flowColor || '#00f0ff'
      this.flows.set(host.id, controller)
    })

    // Seed initial baseline telemetry points so graphs display immediately
    for (let i = 0; i < 4; i++) {
      this.sampleTelemetry()
    }
  }

  // Dijkstra / Shortest Path finding for routing
  findPath(srcNodeId, dstNodeId) {
    const queue = [[srcNodeId]]
    const visited = new Set([srcNodeId])

    while (queue.length > 0) {
      const path = queue.shift()
      const curr = path[path.length - 1]

      if (curr === dstNodeId) {
        return path
      }

      // Find neighbors with active links
      const neighbors = []
      this.topology.links.forEach(link => {
        if (link.status === 'down') return
        if (link.from === curr && !visited.has(link.to)) {
          neighbors.push(link.to)
        } else if (link.to === curr && !visited.has(link.from)) {
          neighbors.push(link.from)
        }
      })

      for (const next of neighbors) {
        visited.add(next)
        queue.push([...path, next])
      }
    }

    return null
  }

  getLinkBetween(u, v) {
    for (const link of this.topology.links) {
      if ((link.from === u && link.to === v) || (link.from === v && link.to === u)) {
        return link
      }
    }
    return null
  }

  // Main Simulation Step (called ~30-60 times per second)
  step(deltaRealMs) {
    const effectiveDelta = deltaRealMs * this.speed
    this.simTimeMs += effectiveDelta

    // 1. Packet injection for each active flow (subject to cwnd and inFlight)
    this.flows.forEach((flow, hostId) => {
      const host = this.nodeMap.get(hostId)
      if (!host) return

      // Pacing or window check
      while (flow.canSendMore()) {
        const seq = flow.recordPacketSent()
        const path = this.findPath(hostId, flow.destServerId)
        if (!path || path.length < 2) break

        const firstLink = this.getLinkBetween(path[0], path[1])
        const linkDelay = firstLink ? firstLink.delay : 5

        const packet = {
          id: `pkt_${this.nextPacketId++}`,
          flowId: flow.flowId,
          flowColor: flow.flowColor,
          srcNode: hostId,
          dstNode: flow.destServerId,
          srcIp: host.ip,
          dstIp: flow.destServerIp,
          sizeBytes: 1460,
          seq: seq,
          ack: 0,
          isAck: false,
          ttl: 64,
          ecnCapable: true,
          path: path,
          hopIndex: 0,
          // Movement along current link
          progress: 0.0,
          linkTransitTimeMs: linkDelay * 4, // Scaled for visual smoothness
          queuedAtRouter: null,
          sendTimestamp: this.simTimeMs
        }

        this.packets.push(packet)
        this.recordNodeIpTraffic(hostId, host.ip, flow.destServerIp, 'OUT', 1460)
      }
    })

    // 2. Advance Packets in transit or process queues
    const survivingPackets = []

    for (let i = 0; i < this.packets.length; i++) {
      const pkt = this.packets[i]

      // A. Packet is queued in an intermediate router buffer
      if (pkt.queuedAtRouter) {
        const router = this.nodeMap.get(pkt.queuedAtRouter)
        const q = this.routerQueues.get(pkt.queuedAtRouter)

        // Simulate link service / departure at head of queue
        if (q && q.peek() && q.peek().id === pkt.id) {
          // Serve packet if departure time reached
          pkt.queueServiceRemainingMs = (pkt.queueServiceRemainingMs || 15) - effectiveDelta
          if (pkt.queueServiceRemainingMs <= 0) {
            // Dequeued! Continue along path
            q.dequeue()
            pkt.queuedAtRouter = null
            pkt.hopIndex++
            pkt.progress = 0

            const nextHop = pkt.path[pkt.hopIndex + 1]
            if (nextHop) {
              const link = this.getLinkBetween(pkt.path[pkt.hopIndex], nextHop)
              pkt.linkTransitTimeMs = (link ? link.delay : 10) * 4
            }
          }
        }
        survivingPackets.push(pkt)
        continue
      }

      // B. Packet is in transit along a link
      const u = pkt.path[pkt.hopIndex]
      const v = pkt.path[pkt.hopIndex + 1]

      if (!u || !v) {
        // Destination arrived!
        this.handlePacketArrival(pkt)
        continue
      }

      const link = this.getLinkBetween(u, v)
      if (link && link.status === 'down') {
        // Link dropped while in flight!
        this.dropPacket(pkt, u, 'LINK_FAILURE')
        continue
      }

      // Check random background loss (e.g. wireless fade)
      if (this.randomLossRate > 0 && Math.random() < (this.randomLossRate / 100) * (effectiveDelta / 1000)) {
        this.dropPacket(pkt, u, 'RANDOM_CHANNEL_LOSS')
        continue
      }

      // Advance along link
      const speedFactor = link ? Math.max(0.5, link.bandwidth / 40) : 1
      pkt.progress += effectiveDelta / (pkt.linkTransitTimeMs / speedFactor)

      if (pkt.progress >= 1.0) {
        // Arrived at next node 'v'
        pkt.progress = 1.0
        pkt.ttl = Math.max(0, pkt.ttl - 1)
        this.recordNodeIpTraffic(v, pkt.srcIp, pkt.dstIp, 'IN', pkt.sizeBytes)

        if (pkt.ttl <= 0) {
          this.dropPacket(pkt, v, 'TTL_EXPIRED')
          continue
        }

        // Is 'v' the final destination?
        if (pkt.hopIndex + 1 >= pkt.path.length - 1) {
          this.handlePacketArrival(pkt)
          continue
        }

        // 'v' is an intermediate router or switch
        const targetRouterQueue = this.routerQueues.get(v)
        if (targetRouterQueue) {
          const enqueueResult = targetRouterQueue.enqueue(pkt)
          if (!enqueueResult.accepted) {
            // Drop due to buffer overflow or RED early drop!
            this.dropPacket(pkt, v, enqueueResult.reason)
            continue
          } else {
            // Successfully enqueued in router buffer
            pkt.queuedAtRouter = v
            pkt.queueServiceRemainingMs = Math.max(8, 25 - (targetRouterQueue.packets.length * 0.5))
            survivingPackets.push(pkt)
            continue
          }
        } else {
          // Pass-through node
          pkt.hopIndex++
          pkt.progress = 0
          const nextLink = this.getLinkBetween(pkt.path[pkt.hopIndex], pkt.path[pkt.hopIndex + 1])
          pkt.linkTransitTimeMs = (nextLink ? nextLink.delay : 10) * 4
        }
      }

      survivingPackets.push(pkt)
    }

    this.packets = survivingPackets

    // 3. Update Visual Explosion / Drop Particles
    this.updateDroppedParticles(effectiveDelta)

    // 4. Sample Telemetry for Real-time Graphs (sample frequently and in real-time)
    const now = Date.now()
    if (this.simTimeMs - this.lastTelemetrySampleTime >= 150 || (now - (this.lastTelemetrySampleRealTime || 0)) >= 250) {
      this.sampleTelemetry()
      this.lastTelemetrySampleTime = this.simTimeMs
      this.lastTelemetrySampleRealTime = now
    }

    // 5. Notify renderers
    this.notifyTick()
  }

  handlePacketArrival(pkt) {
    if (!pkt.isAck) {
      // DATA packet reached Server! Generate ACK on reverse path
      const flow = this.flows.get(pkt.flowId)
      const reversePath = [...pkt.path].reverse()

      const ackPacket = {
        id: `ack_${this.nextPacketId++}`,
        flowId: pkt.flowId,
        flowColor: '#e0f2fe',
        srcNode: pkt.dstNode,
        dstNode: pkt.srcNode,
        srcIp: pkt.dstIp,
        dstIp: pkt.srcIp,
        sizeBytes: 64, // TCP ACK header
        seq: 0,
        ack: pkt.seq,
        isAck: true,
        ttl: 64,
        path: reversePath,
        hopIndex: 0,
        progress: 0.0,
        linkTransitTimeMs: 15,
        originalSendTimestamp: pkt.sendTimestamp,
        sampleRtt: Math.max(15, this.simTimeMs - pkt.sendTimestamp)
      }

      this.packets.push(ackPacket)
    } else {
      // ACK packet reached Source Host! Update Congestion Window
      const flow = this.flows.get(pkt.flowId)
      if (flow) {
        flow.onAckReceived(pkt, this.simTimeMs)
      }
    }
  }

  dropPacket(pkt, atNodeId, reason = 'BUFFER_OVERFLOW') {
    const node = this.nodeMap.get(atNodeId)
    const posX = node ? node.x : 500
    const posY = node ? node.y : 300

    // Spawn visual explosion particles for high-tech UI feedback
    this.spawnDropParticles(posX, posY, pkt.flowColor, reason)

    // Flow notification: packet lost
    const flow = this.flows.get(pkt.flowId)
    if (flow) {
      // Trigger duplicate ACK or fast recovery
      const res = flow.onDuplicateAck(this.simTimeMs)
      if (res.retransmit) {
        // Handle retransmit on loss
        flow.onTimeout(this.simTimeMs)
      }
    }

    // Record drop in node stats
    const stats = this.nodeIpStats.get(atNodeId)
    if (stats) {
      stats.totalDrops++
      stats.recentForwardingLog.unshift({
        time: (this.simTimeMs / 1000).toFixed(2),
        srcIp: pkt.srcIp,
        dstIp: pkt.dstIp,
        action: `DROP: ${reason}`,
        seq: pkt.seq
      })
      if (stats.recentForwardingLog.length > 20) stats.recentForwardingLog.pop()
    }
  }

  spawnDropParticles(x, y, color, reason) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 25 + Math.random() * 45
      this.droppedParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#ef4444', // Red glow
        alpha: 1.0,
        life: 0.7, // seconds
        reason
      })
    }
  }

  updateDroppedParticles(deltaMs) {
    const dt = deltaMs / 1000
    for (let i = this.droppedParticles.length - 1; i >= 0; i--) {
      const p = this.droppedParticles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      p.alpha = Math.max(0, p.life / 0.7)
      if (p.life <= 0) {
        this.droppedParticles.splice(i, 1)
      }
    }
  }

  recordNodeIpTraffic(nodeId, srcIp, dstIp, direction, sizeBytes) {
    const stats = this.nodeIpStats.get(nodeId)
    if (!stats) return

    if (direction === 'IN') {
      stats.totalInPkts++
      stats.totalInBytes += sizeBytes
    } else {
      stats.totalOutPkts++
      stats.totalOutBytes += sizeBytes
    }

    if (!stats.ipCounters[srcIp]) {
      stats.ipCounters[srcIp] = { inPkts: 0, outPkts: 0, inBytes: 0, outBytes: 0, drops: 0 }
    }
    if (direction === 'IN') {
      stats.ipCounters[srcIp].inPkts++
      stats.ipCounters[srcIp].inBytes += sizeBytes
    } else {
      stats.ipCounters[srcIp].outPkts++
      stats.ipCounters[srcIp].outBytes += sizeBytes
    }
  }

  // Periodic Telemetry Sampling
  sampleTelemetry() {
    let aggregateCwnd = 0
    let aggregateThpt = 0
    let aggregateRtt = 0
    let activeFlowCount = 0

    this.flows.forEach(flow => {
      aggregateCwnd += flow.cwnd
      aggregateRtt += flow.srtt
      // Approximate instantaneous throughput in Mbps
      const thpt = (flow.cwnd / (Math.max(10, flow.srtt) / 1000)) * (1460 * 8 / 1e6)
      aggregateThpt += thpt
      activeFlowCount++
    })

    const avgRtt = activeFlowCount > 0 ? aggregateRtt / activeFlowCount : 35
    const bottleneckQ = this.routerQueues.get(this.topology.defaultBottleneckId || 'r_bottleneck')
    const queueDepth = bottleneckQ ? bottleneckQ.packets.length : 0
    const queueMax = bottleneckQ ? bottleneckQ.capacity : 25

    const elapsedRealSec = Number(((Date.now() - (this.startTimeReal || Date.now())) / 1000).toFixed(1))
    const simSec = Number((this.simTimeMs / 1000).toFixed(1))
    const displayTime = this.speed >= 0.5 ? simSec : elapsedRealSec

    const point = {
      time: displayTime,
      cwnd: Number((aggregateCwnd / Math.max(1, activeFlowCount)).toFixed(2)),
      throughput: Number(aggregateThpt.toFixed(2)),
      rtt: Number(avgRtt.toFixed(1)),
      queueOccupancy: Number(((queueDepth / queueMax) * 100).toFixed(1)),
      queueDepth,
      inFlightTotal: this.packets.length
    }

    this.telemetryHistory.push(point)
    if (this.telemetryHistory.length > this.maxHistoryPoints) {
      this.telemetryHistory.shift()
    }
  }

  // Inject a burst traffic spike to stress test congestion recovery
  injectCongestionSpike(packetBurstCount = 18) {
    const defaultHost = Array.from(this.flows.keys())[0] || 'h1'
    const flow = this.flows.get(defaultHost)
    const host = this.nodeMap.get(defaultHost)
    if (!flow || !host) return

    for (let k = 0; k < packetBurstCount; k++) {
      const path = this.findPath(defaultHost, flow.destServerId)
      if (!path) break

      const burstPkt = {
        id: `burst_${this.nextPacketId++}`,
        flowId: defaultHost,
        flowColor: '#f97316', // Orange spike
        srcNode: defaultHost,
        dstNode: flow.destServerId,
        srcIp: host.ip,
        dstIp: flow.destServerIp,
        sizeBytes: 1460,
        seq: flow.recordPacketSent(),
        ack: 0,
        isAck: false,
        ttl: 64,
        ecnCapable: false,
        path: path,
        hopIndex: 0,
        progress: 0.1 * (k % 4),
        linkTransitTimeMs: 12,
        sendTimestamp: this.simTimeMs
      }
      this.packets.push(burstPkt)
    }
  }

  // Toggle link status (simulate fiber cut or link flap)
  toggleLink(linkId) {
    const link = this.linkMap.get(linkId)
    if (link) {
      link.status = link.status === 'up' ? 'down' : 'up'
      return link.status
    }
    return null
  }

  // Adjust bottleneck parameters dynamically
  setBottleneckBandwidth(bwMbps) {
    this.bottleneckBw = bwMbps
    this.topology.links.forEach(l => {
      if (l.isBottleneckLink) l.bandwidth = bwMbps
    })
  }

  setBottleneckBuffer(bufferCapacity) {
    this.bottleneckBuffer = bufferCapacity
    const bId = this.topology.defaultBottleneckId || 'r_bottleneck'
    const q = this.routerQueues.get(bId)
    if (q) q.capacity = bufferCapacity
  }

  setQueuePolicy(policy) {
    this.queuePolicy = policy
    this.routerQueues.forEach(q => {
      q.policy = policy
    })
  }

  setAlgorithm(algoKey) {
    this.algorithmKey = algoKey
    this.flows.forEach(flow => {
      flow.algorithmKey = algoKey
      flow.algoDef = ALGORITHMS[algoKey] || ALGORITHMS.RENO
      flow.cwnd = 2
      flow.ssthresh = 32
      flow.state = 'SLOW_START'
    })
  }

  setSpeed(multiplier) {
    this.speed = Math.max(0.005, Math.min(100.0, multiplier))
  }

  // Start simulation loop
  start() {
    if (this.isRunning) return
    this.isRunning = true
    let lastTime = performance.now()

    const loop = (currentTime) => {
      if (!this.isRunning) return
      const delta = Math.min(100, currentTime - lastTime)
      lastTime = currentTime
      this.step(delta)
      this.animationFrame = requestAnimationFrame(loop)
    }

    this.animationFrame = requestAnimationFrame(loop)
  }

  pause() {
    this.isRunning = false
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  stepOnce(ms = 30) {
    this.step(ms)
  }

  stepProgress(percentDelta = 0.15) {
    if (!this.packets || this.packets.length === 0) {
      this.stepOnce(60)
      return
    }
    this.packets.forEach(pkt => {
      if (pkt.queuedAtRouter) {
        pkt.queueServiceRemainingMs = Math.max(0, (pkt.queueServiceRemainingMs || 15) - 15)
      } else {
        pkt.progress = Math.min(1.0, (pkt.progress || 0) + percentDelta)
      }
    })
    this.step(2)
  }

  reset() {
    this.pause()
    this.initTopology()
    this.notifyTick()
  }

  onTick(fn) {
    this.onTickListeners.add(fn)
    return () => this.onTickListeners.delete(fn)
  }

  notifyTick() {
    this.onTickListeners.forEach(fn => fn(this))
  }

  // Dynamic Network Building Methods (Cisco Packet Tracer Mode)
  addNode(nodeData) {
    const id = nodeData.id || `${nodeData.type || 'node'}_${Date.now()}`
    const node = {
      id,
      name: nodeData.name || (nodeData.type === 'router' ? `Router-${this.topology.nodes.length + 1}` : nodeData.type === 'switch' ? `Switch-${this.topology.nodes.length + 1}` : nodeData.type === 'server' ? `Server-${this.topology.nodes.length + 1}` : `PC-${this.topology.nodes.length + 1}`),
      type: nodeData.type || 'host',
      ip: nodeData.ip || (nodeData.type === 'server' ? `192.168.100.${10 + this.topology.nodes.length}` : `192.168.1.${10 + this.topology.nodes.length}`),
      subnet: nodeData.subnet || '192.168.1.0/24',
      x: nodeData.x || 200,
      y: nodeData.y || 200,
      flowColor: nodeData.flowColor || '#00f0ff',
      bufferSize: nodeData.bufferSize || 30,
      isBottleneck: nodeData.isBottleneck || false,
      active: true
    }

    this.topology.nodes.push(node)
    this.nodeMap.set(node.id, node)

    if (node.type === 'router' || node.type === 'switch') {
      const capacity = node.isBottleneck ? this.bottleneckBuffer : (node.bufferSize || 30)
      this.routerQueues.set(node.id, new RouterQueue(node.id, capacity, this.queuePolicy))
    }

    this.nodeIpStats.set(node.id, {
      nodeId: node.id,
      nodeName: node.name,
      primaryIp: node.ip,
      subnet: node.subnet,
      type: node.type,
      ipCounters: {},
      totalInPkts: 0,
      totalOutPkts: 0,
      totalInBytes: 0,
      totalOutBytes: 0,
      totalDrops: 0,
      recentForwardingLog: []
    })

    if (node.type === 'host') {
      const serverNodes = this.topology.nodes.filter(n => n.type === 'server')
      const targetServer = serverNodes[0] || null
      const controller = new FlowController(node.id, this.algorithmKey, this.options)
      if (targetServer) {
        controller.destServerId = targetServer.id
        controller.destServerIp = targetServer.ip
      }
      controller.flowColor = node.flowColor || '#00f0ff'
      this.flows.set(node.id, controller)
    }

    this.notifyTick()
    return node
  }

  moveNode(nodeId, x, y) {
    const node = this.nodeMap.get(nodeId)
    if (node) {
      node.x = x
      node.y = y
    }
  }

  removeNode(nodeId) {
    // Remove connected links
    this.topology.links = this.topology.links.filter(link => {
      const connected = link.from === nodeId || link.to === nodeId
      if (connected) {
        this.linkMap.delete(link.id)
      }
      return !connected
    })

    // Remove node
    this.topology.nodes = this.topology.nodes.filter(n => n.id !== nodeId)
    this.nodeMap.delete(nodeId)
    this.routerQueues.delete(nodeId)
    this.nodeIpStats.delete(nodeId)
    this.flows.delete(nodeId)

    // Remove packets linked to this node
    this.packets = this.packets.filter(pkt => pkt.srcNode !== nodeId && pkt.dstNode !== nodeId && !pkt.path.includes(nodeId))
    this.notifyTick()
  }

  addLink(fromId, toId, options = {}) {
    if (fromId === toId) return null
    if (!this.nodeMap.has(fromId) || !this.nodeMap.has(toId)) return null

    // Check if link exists
    const existing = this.getLinkBetween(fromId, toId)
    if (existing) return existing

    const linkId = `link_${fromId}_${toId}_${Date.now()}`
    const link = {
      id: linkId,
      from: fromId,
      to: toId,
      bandwidth: options.bandwidth || 100,
      delay: options.delay || 5,
      isBottleneckLink: options.isBottleneckLink || false,
      status: 'up'
    }

    this.topology.links.push(link)
    this.linkMap.set(link.id, link)

    // Refresh flow destinations if newly connected
    this.refreshFlowRoutes()
    this.notifyTick()
    return link
  }

  removeLink(linkId) {
    this.topology.links = this.topology.links.filter(l => l.id !== linkId)
    this.linkMap.delete(linkId)
    this.notifyTick()
  }

  refreshFlowRoutes() {
    const serverNodes = this.topology.nodes.filter(n => n.type === 'server')
    this.flows.forEach((flow) => {
      if (!flow.destServerId || !this.nodeMap.has(flow.destServerId)) {
        if (serverNodes.length > 0) {
          flow.destServerId = serverNodes[0].id
          flow.destServerIp = serverNodes[0].ip
        }
      }
    })
  }

  clearWorkspace() {
    this.topology.nodes = []
    this.topology.links = []
    this.nodeMap.clear()
    this.linkMap.clear()
    this.routerQueues.clear()
    this.nodeIpStats.clear()
    this.flows.clear()
    this.packets = []
    this.droppedParticles = []
    this.telemetryHistory = []
    this.notifyTick()
  }

  injectCustomPacket(options) {
    const { srcNodeId, dstNodeId, protocol = 'TCP', sizeBytes = 1460, count = 1, flowColor = '#10b981', srcIp, dstIp } = options
    const srcNode = this.nodeMap.get(srcNodeId)
    const dstNode = this.nodeMap.get(dstNodeId)
    if (!srcNode || !dstNode) return { success: false, error: 'Source or destination device not found.' }

    const path = this.findPath(srcNodeId, dstNodeId)
    if (!path || path.length < 2) {
      return { success: false, error: `No active network path between ${srcNode.name} and ${dstNode.name}. Connect them with a cable first!` }
    }

    const firstLink = this.getLinkBetween(path[0], path[1])
    const linkDelay = firstLink ? firstLink.delay : 10

    for (let k = 0; k < count; k++) {
      const pktId = `pdu_${this.nextPacketId++}_${Date.now()}`
      const pdu = {
        id: pktId,
        flowId: srcNodeId,
        flowColor: flowColor,
        srcNode: srcNodeId,
        dstNode: dstNodeId,
        srcIp: srcIp || srcNode.ip,
        dstIp: dstIp || dstNode.ip,
        protocol: protocol,
        sizeBytes: sizeBytes,
        seq: k + 1,
        ack: 0,
        isAck: false,
        ttl: 64,
        ecnCapable: true,
        path: path,
        hopIndex: 0,
        progress: (k % 3) * 0.04,
        linkTransitTimeMs: linkDelay * 4,
        queuedAtRouter: null,
        sendTimestamp: this.simTimeMs,
        pduLayers: {
          layer1: { inPort: 'FastEthernet0/1', outPort: 'FastEthernet0/1', physicalSpeed: `${firstLink?.bandwidth || 100} Mbps` },
          layer2: {
            srcMac: `00:0C:CF:${(10 + (k % 80)).toString(16).padStart(2, '0')}:A1:${srcNode.id.slice(-2)}`,
            dstMac: `00:0C:CF:88:B2:${dstNode.id.slice(-2)}`,
            frameType: '0x0800 (IPv4)'
          },
          layer3: {
            srcIp: srcIp || srcNode.ip,
            dstIp: dstIp || dstNode.ip,
            ttl: 64,
            protocol: protocol === 'ICMP' ? 'ICMP (1)' : protocol === 'UDP' ? 'UDP (17)' : 'TCP (6)'
          },
          layer4: {
            srcPort: 49152 + (k % 1000),
            dstPort: protocol === 'ICMP' ? 'Echo (0x08)' : 80,
            seq: k + 1,
            ack: 0,
            windowSize: 65535,
            flags: protocol === 'ICMP' ? 'Type 8, Code 0' : 'SYN, ACK'
          },
          payload: `Cisco Packet Tracer Simulated ${protocol} PDU Envelope #${k + 1}`
        }
      }
      this.packets.push(pdu)
      this.recordNodeIpTraffic(srcNodeId, srcNode.ip, dstNode.ip, 'OUT', sizeBytes)
    }

    this.notifyTick()
    return { success: true, count }
  }
}
