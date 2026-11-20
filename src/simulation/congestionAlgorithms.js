// Mathematical implementation of Congestion Control Algorithms & Active Queue Management

export const ALGORITHMS = {
  TAHOE: {
    id: 'TAHOE',
    name: 'TCP Tahoe (Jacobson 1988)',
    category: 'Loss-Based Classic',
    description: 'Slow Start, Congestion Avoidance, Fast Retransmit. Drops cwnd to 1 on any packet loss.',
    defaultParams: {
      initialCwnd: 1,
      initialSsthresh: 32,
    }
  },
  RENO: {
    id: 'RENO',
    name: 'TCP Reno (Stevens 1990)',
    category: 'Loss-Based Industry Standard',
    description: 'Adds Fast Recovery: on 3 duplicate ACKs, cuts cwnd to ssthresh/2 without dropping to 1.',
    defaultParams: {
      initialCwnd: 1,
      initialSsthresh: 32,
    }
  },
  NEW_RENO: {
    id: 'NEW_RENO',
    name: 'TCP NewReno (RFC 6582)',
    category: 'Loss-Based Enhanced',
    description: 'Handles multiple packet drops within a single window using Partial ACKs in Fast Recovery.',
    defaultParams: {
      initialCwnd: 1,
      initialSsthresh: 32,
    }
  },
  CUBIC: {
    id: 'CUBIC',
    name: 'TCP CUBIC (Linux Default RFC 8312)',
    category: 'Cubic Window Function',
    description: 'Polynomial window growth W(t) = C*(t - K)^3 + Wmax. Scales well over high-BDP links.',
    defaultParams: {
      initialCwnd: 2,
      initialSsthresh: 32,
      C: 0.4,
      beta: 0.7,
    }
  },
  BBR: {
    id: 'BBR',
    name: 'Google BBR (BtlBw & RTprop)',
    category: 'Model-Based / Delay & Pacing',
    description: 'Cardwell et al. Maximizes bottleneck throughput while bounding queue delay. Not loss-driven.',
    defaultParams: {
      initialCwnd: 4,
      pacingGainCycle: [1.25, 0.75, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      probeRttIntervalMs: 10000,
    }
  },
  AIMD: {
    id: 'AIMD',
    name: 'Generic AIMD (α, β)',
    category: 'Parametric Congestion Control',
    description: 'Tunable Additive Increase Multiplicative Decrease algorithm with custom alpha and beta.',
    defaultParams: {
      alpha: 1.0, // Additive increase per RTT
      beta: 0.5,  // Multiplicative decrease factor (0.5 = halve)
      initialCwnd: 1,
      initialSsthresh: 32,
    }
  }
}

export class FlowController {
  constructor(flowId, algorithmKey, options = {}) {
    this.flowId = flowId
    this.algorithmKey = algorithmKey || 'RENO'
    this.algoDef = ALGORITHMS[this.algorithmKey] || ALGORITHMS.RENO

    // Window and state tracking
    this.cwnd = options.initialCwnd || (this.algoDef.defaultParams.initialCwnd || 1)
    this.ssthresh = options.initialSsthresh || (this.algoDef.defaultParams.initialSsthresh || 32)
    this.state = 'SLOW_START' // SLOW_START, CONGESTION_AVOIDANCE, FAST_RECOVERY, BBR_STARTUP, BBR_DRAIN, BBR_PROBE_BW, BBR_PROBE_RTT
    this.dupAckCount = 0
    this.lastAckedSeq = 0
    this.highestSeqSent = 0
    this.inFlight = 0

    // RTT estimation (Jacobson's algorithm: RFC 6298)
    this.srtt = 40       // Smoothed Round Trip Time (ms)
    this.rttvar = 10     // RTT Variation
    this.rto = 100       // Retransmission Timeout (ms)
    this.minRtt = 9999   // RTprop estimate

    // Throughput & accounting
    this.bytesAckedTotal = 0
    this.packetsSentTotal = 0
    this.packetsAckedTotal = 0
    this.packetsLostTotal = 0
    this.retransmissionsTotal = 0

    // CUBIC specific state
    this.wMax = this.cwnd
    this.epochStart = 0
    this.K = 0
    this.C = options.C || 0.4
    this.cubicBeta = options.beta || 0.7

    // BBR specific state
    this.btlBw = 1.0 // Mbps estimated
    this.bbrCycleIndex = 0
    this.pacingRate = 1.0 // packets per sec
    this.bbrPhaseTime = 0
    this.lastProbeRttTime = 0

    // AIMD custom
    this.aimdAlpha = options.alpha !== undefined ? options.alpha : 1.0
    this.aimdBeta = options.beta !== undefined ? options.beta : 0.5
  }

  // Called when a valid (new) ACK arrives
  onAckReceived(ackPacket, nowMs) {
    this.packetsAckedTotal++
    this.bytesAckedTotal += ackPacket.sizeBytes || 1460
    this.inFlight = Math.max(0, this.inFlight - 1)
    this.dupAckCount = 0

    // Update RTT telemetry using RFC 6298
    if (ackPacket.sampleRtt) {
      const sample = ackPacket.sampleRtt
      if (sample < this.minRtt) this.minRtt = sample
      if (this.srtt === 0) {
        this.srtt = sample
        this.rttvar = sample / 2
      } else {
        this.rttvar = (1 - 0.25) * this.rttvar + 0.25 * Math.abs(this.srtt - sample)
        this.srtt = (1 - 0.125) * this.srtt + 0.125 * sample
      }
      this.rto = Math.max(80, Math.min(2000, this.srtt + 4 * this.rttvar))

      // Estimate delivery rate for BBR
      const deliveryRate = 1 / (sample / 1000)
      if (deliveryRate > this.btlBw) {
        this.btlBw = deliveryRate
      }
    }

    // Algorithm Specific Window updates
    switch (this.algorithmKey) {
      case 'TAHOE':
        this.updateTahoeOnAck()
        break
      case 'RENO':
        this.updateRenoOnAck()
        break
      case 'NEW_RENO':
        this.updateNewRenoOnAck()
        break
      case 'CUBIC':
        this.updateCubicOnAck(nowMs)
        break
      case 'BBR':
        this.updateBbrOnAck(nowMs)
        break
      case 'AIMD':
        this.updateAimdOnAck()
        break
      default:
        this.updateRenoOnAck()
    }

    // Ensure cwnd does not drop below 1
    this.cwnd = Math.max(1, this.cwnd)
  }

  // Tahoe ACK update
  updateTahoeOnAck() {
    if (this.cwnd < this.ssthresh) {
      this.state = 'SLOW_START'
      this.cwnd += 1.0 // exponential growth: 1 per ACK
    } else {
      this.state = 'CONGESTION_AVOIDANCE'
      this.cwnd += 1.0 / this.cwnd // linear: +1 per full RTT window
    }
  }

  // Reno ACK update
  updateRenoOnAck() {
    if (this.state === 'FAST_RECOVERY') {
      // Exit fast recovery on fresh ACK
      this.cwnd = this.ssthresh
      this.state = 'CONGESTION_AVOIDANCE'
    } else if (this.cwnd < this.ssthresh) {
      this.state = 'SLOW_START'
      this.cwnd += 1.0
    } else {
      this.state = 'CONGESTION_AVOIDANCE'
      this.cwnd += 1.0 / this.cwnd
    }
  }

  // NewReno ACK update
  updateNewRenoOnAck() {
    if (this.state === 'FAST_RECOVERY') {
      this.cwnd = this.ssthresh
      this.state = 'CONGESTION_AVOIDANCE'
    } else if (this.cwnd < this.ssthresh) {
      this.state = 'SLOW_START'
      this.cwnd += 1.0
    } else {
      this.state = 'CONGESTION_AVOIDANCE'
      this.cwnd += 1.0 / this.cwnd
    }
  }

  // CUBIC ACK update
  updateCubicOnAck(nowMs) {
    if (this.cwnd < this.ssthresh) {
      this.state = 'SLOW_START'
      this.cwnd += 1.0
      this.epochStart = nowMs
    } else {
      this.state = 'CONGESTION_AVOIDANCE'
      const t = Math.max(0.01, (nowMs - this.epochStart) / 1000)
      // W_cubic(t) = C * (t - K)^3 + Wmax
      const targetW = this.C * Math.pow(t - this.K, 3) + this.wMax
      if (targetW > this.cwnd) {
        this.cwnd += (targetW - this.cwnd) / this.cwnd
      } else {
        this.cwnd += 1.0 / this.cwnd
      }
    }
  }

  // BBR ACK update
  updateBbrOnAck(nowMs) {
    const cycle = [1.25, 0.75, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
    const bdp = Math.max(2, (this.btlBw * (this.minRtt / 1000)) * 8) // in packets

    if (!this.bbrPhaseTime) this.bbrPhaseTime = nowMs
    if (nowMs - this.bbrPhaseTime > Math.max(100, this.srtt)) {
      this.bbrCycleIndex = (this.bbrCycleIndex + 1) % cycle.length
      this.bbrPhaseTime = nowMs
    }

    const pacingGain = cycle[this.bbrCycleIndex]
    const targetCwnd = bdp * 2 * pacingGain
    this.cwnd = Math.max(2, Math.min(64, targetCwnd))
    this.state = `BBR_CYCLE_${this.bbrCycleIndex}`
  }

  // AIMD ACK update
  updateAimdOnAck() {
    if (this.cwnd < this.ssthresh) {
      this.state = 'SLOW_START'
      this.cwnd += 1.0
    } else {
      this.state = 'CONGESTION_AVOIDANCE'
      this.cwnd += this.aimdAlpha / this.cwnd
    }
  }

  // Duplicate ACK handler
  onDuplicateAck(nowMs) {
    this.dupAckCount++

    if (this.algorithmKey === 'TAHOE') {
      if (this.dupAckCount === 3) {
        // Fast Retransmit: reset cwnd to 1
        this.packetsLostTotal++
        this.ssthresh = Math.max(2, Math.floor(this.cwnd / 2))
        this.cwnd = 1
        this.state = 'SLOW_START'
        return { retransmit: true, reason: '3_DUP_ACKS_TAHOE_RESET' }
      }
    } else if (this.algorithmKey === 'RENO' || this.algorithmKey === 'NEW_RENO') {
      if (this.dupAckCount === 3) {
        // Fast Recovery entry
        this.packetsLostTotal++
        this.ssthresh = Math.max(2, Math.floor(this.cwnd / 2))
        this.cwnd = this.ssthresh + 3
        this.state = 'FAST_RECOVERY'
        return { retransmit: true, reason: 'FAST_RECOVERY_ENTER' }
      } else if (this.dupAckCount > 3 && this.state === 'FAST_RECOVERY') {
        // Inflate window for each subsequent duplicate ACK
        this.cwnd += 1
      }
    } else if (this.algorithmKey === 'CUBIC') {
      if (this.dupAckCount === 3) {
        this.packetsLostTotal++
        this.wMax = this.cwnd
        this.ssthresh = Math.max(2, Math.floor(this.cwnd * this.cubicBeta))
        this.cwnd = this.ssthresh
        this.epochStart = nowMs
        // Calculate K = cuberoot((Wmax * beta) / C)
        this.K = Math.cbrt((this.wMax * (1 - this.cubicBeta)) / this.C)
        this.state = 'FAST_RECOVERY'
        return { retransmit: true, reason: 'CUBIC_MULTIPLICATIVE_DECREASE' }
      }
    } else if (this.algorithmKey === 'AIMD') {
      if (this.dupAckCount === 3) {
        this.packetsLostTotal++
        this.ssthresh = Math.max(2, Math.floor(this.cwnd * this.aimdBeta))
        this.cwnd = this.ssthresh
        this.state = 'CONGESTION_AVOIDANCE'
        return { retransmit: true, reason: 'AIMD_BACKOFF' }
      }
    }

    return { retransmit: false }
  }

  // Timeout handler (Severe loss)
  onTimeout(nowMs) {
    this.packetsLostTotal++
    this.retransmissionsTotal++
    this.ssthresh = Math.max(2, Math.floor(this.cwnd / 2))
    this.cwnd = 1
    this.dupAckCount = 0
    this.state = 'SLOW_START'
    this.rto = Math.min(3000, this.rto * 2) // Exponential backoff

    if (this.algorithmKey === 'CUBIC') {
      this.wMax = this.cwnd
      this.epochStart = nowMs
      this.K = 0
    }
  }

  canSendMore() {
    return this.inFlight < Math.floor(this.cwnd)
  }

  recordPacketSent() {
    this.packetsSentTotal++
    this.highestSeqSent++
    this.inFlight++
    return this.highestSeqSent
  }
}

// Router Active Queue Management (Tail Drop vs RED)
export class RouterQueue {
  constructor(nodeId, capacity = 25, policy = 'TAIL_DROP', redConfig = {}) {
    this.nodeId = nodeId
    this.capacity = capacity
    this.policy = policy // 'TAIL_DROP' or 'RED'
    this.packets = []

    // RED Parameters (Floyd and Jacobson 1993)
    this.avgQueueLength = 0
    this.wq = redConfig.wq || 0.002 // weight factor for moving average
    this.minTh = redConfig.minTh || Math.floor(capacity * 0.3)
    this.maxTh = redConfig.maxTh || Math.floor(capacity * 0.8)
    this.maxP = redConfig.maxP || 0.15 // max mark/drop probability
    this.countSinceLastDrop = 0

    // Stats
    this.totalEnqueued = 0
    this.totalDequeued = 0
    this.totalDroppedTail = 0
    this.totalDroppedRed = 0
    this.totalMarkedEcn = 0
  }

  enqueue(packet) {
    const currentQ = this.packets.length

    // Update RED average queue length
    this.avgQueueLength = (1 - this.wq) * this.avgQueueLength + this.wq * currentQ

    if (this.policy === 'RED') {
      if (this.avgQueueLength < this.minTh) {
        this.countSinceLastDrop++
      } else if (this.avgQueueLength >= this.minTh && this.avgQueueLength < this.maxTh) {
        this.countSinceLastDrop++
        const pb = this.maxP * ((this.avgQueueLength - this.minTh) / (this.maxTh - this.minTh))
        const pa = pb / (1 - this.countSinceLastDrop * pb)

        if (Math.random() < pa) {
          // Check if ECN capable
          if (packet.ecnCapable) {
            packet.ecnMarked = true
            this.totalMarkedEcn++
          } else {
            this.totalDroppedRed++
            this.countSinceLastDrop = 0
            return { accepted: false, reason: 'RED_EARLY_DROP', queueSize: currentQ }
          }
        }
      } else if (this.avgQueueLength >= this.maxTh) {
        this.totalDroppedRed++
        this.countSinceLastDrop = 0
        return { accepted: false, reason: 'RED_MAX_THRESH_EXCEEDED', queueSize: currentQ }
      }
    }

    // Tail Drop Check
    if (this.packets.length >= this.capacity) {
      this.totalDroppedTail++
      return { accepted: false, reason: 'BUFFER_OVERFLOW', queueSize: currentQ }
    }

    this.packets.push(packet)
    this.totalEnqueued++
    return { accepted: true, queueSize: this.packets.length }
  }

  dequeue() {
    if (this.packets.length === 0) return null
    const pkt = this.packets.shift()
    this.totalDequeued++
    return pkt
  }

  peek() {
    return this.packets.length > 0 ? this.packets[0] : null
  }

  getOccupancyRatio() {
    return this.capacity > 0 ? this.packets.length / this.capacity : 0
  }

  clear() {
    this.packets = []
    this.avgQueueLength = 0
  }
}
