import React, { useState, useEffect, useRef } from 'react'
import {
  Play, Pause, SkipForward, RotateCcw, Zap, BarChart3,
  Network, Cpu, ChevronDown, ChevronUp, Sun, Moon,
  SlidersHorizontal, FastForward
} from 'lucide-react'
import { SimulationEngine } from './simulation/simulationEngine'
import { ALGORITHMS } from './simulation/congestionAlgorithms'
import { TOPOLOGIES } from './simulation/networkTopology'
import NetworkCanvas from './components/NetworkCanvas'
import TelemetryCharts from './components/TelemetryCharts'
import NodeInspectorModal from './components/NodeInspectorModal'
import FileComparatorReportModal from './components/FileComparatorReportModal'
import CiscoDevicePalette from './components/CiscoDevicePalette'
import PacketCustomizerModal from './components/PacketCustomizerModal'
import PduInspectorModal from './components/PduInspectorModal'

export default function App() {
  const [topologyKey, setTopologyKey] = useState('DUMBBELL_CLASSIC')
  const [algorithmKey, setAlgorithmKey] = useState('RENO')
  const [bottleneckBw, setBottleneckBw] = useState(16)
  const [bottleneckBuffer, setBottleneckBuffer] = useState(22)
  const [queuePolicy, setQueuePolicy] = useState('TAIL_DROP')
  const [randomLossRate, setRandomLossRate] = useState(0)

  // Simulation speed: Supports 0.01x (0.01% / micro slow-mo) up to 100x!
  const [speed, setSpeed] = useState(1.0)
  const [isRunning, setIsRunning] = useState(true)

  // Theme: LIGHT THEME by default as requested!
  const [isDark, setIsDark] = useState(false)

  // Cisco Packet Tracer Interactive Tools
  const [activeTool, setActiveTool] = useState('SELECT') // 'SELECT' | 'CONNECT' | 'DELETE' | 'SIMPLE_PDU'
  const [cableSourceNode, setCableSourceNode] = useState(null)
  const [pduSourceNode, setPduSourceNode] = useState(null)

  // Modals & Panels
  const [selectedNode, setSelectedNode] = useState(null)
  const [inspectingPacket, setInspectingPacket] = useState(null)
  const [showCustomPduModal, setShowCustomPduModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  const [showTelemetryDock, setShowTelemetryDock] = useState(true)

  // Adjustable Graph Dock Height
  const [dockHeight, setDockHeight] = useState(240) // 160px to 420px

  // Simulation Engine Instance Ref
  const engineRef = useRef(null)
  const [, setTickCounter] = useState(0)

  // Initialize engine on mount or topology change
  useEffect(() => {
    const engine = new SimulationEngine(topologyKey, algorithmKey, {
      bottleneckBw,
      bottleneckBuffer,
      queuePolicy,
      randomLossRate
    })
    engineRef.current = engine

    // Subscribe to engine ticks
    const unsubscribe = engine.onTick(() => {
      setTickCounter(c => (c + 1) % 10000)
    })

    if (isRunning) {
      engine.start()
    }

    return () => {
      unsubscribe()
      engine.pause()
    }
  }, [topologyKey])

  // React to parameter changes
  useEffect(() => {
    if (engineRef.current) engineRef.current.setAlgorithm(algorithmKey)
  }, [algorithmKey])

  useEffect(() => {
    if (engineRef.current) engineRef.current.setBottleneckBandwidth(bottleneckBw)
  }, [bottleneckBw])

  useEffect(() => {
    if (engineRef.current) engineRef.current.setBottleneckBuffer(bottleneckBuffer)
  }, [bottleneckBuffer])

  useEffect(() => {
    if (engineRef.current) engineRef.current.setQueuePolicy(queuePolicy)
  }, [queuePolicy])

  useEffect(() => {
    if (engineRef.current) engineRef.current.randomLossRate = randomLossRate
  }, [randomLossRate])

  useEffect(() => {
    if (engineRef.current) engineRef.current.setSpeed(speed)
  }, [speed])

  // Play / Pause toggler
  const togglePlay = () => {
    if (!engineRef.current) return
    if (isRunning) {
      engineRef.current.pause()
      setIsRunning(false)
    } else {
      engineRef.current.start()
      setIsRunning(true)
    }
  }

  // Step Forward (discrete event step)
  const handleStep = () => {
    if (!engineRef.current) return
    if (isRunning) {
      engineRef.current.pause()
      setIsRunning(false)
    }
    engineRef.current.stepOnce(40)
  }

  // Step Hop (Demo advancement +15% progress)
  const handleStepHop = () => {
    if (!engineRef.current) return
    if (isRunning) {
      engineRef.current.pause()
      setIsRunning(false)
    }
    engineRef.current.stepProgress(0.15)
  }

  // Reset Simulation
  const handleReset = () => {
    if (!engineRef.current) return
    engineRef.current.reset()
    if (isRunning) {
      engineRef.current.start()
    }
  }

  // Inject Traffic Spike
  const handleInjectSpike = () => {
    if (engineRef.current) {
      engineRef.current.injectCongestionSpike(20)
    }
  }

  // Send Single Demonstration Packet
  const handleSendDemoPacket = () => {
    if (!engineRef.current) return
    const nodes = engineRef.current.topology.nodes
    const host = nodes.find(n => n.type === 'host') || nodes[0]
    const server = nodes.find(n => n.type === 'server') || nodes[nodes.length - 1]
    if (host && server) {
      engineRef.current.injectCustomPacket({
        srcNodeId: host.id,
        dstNodeId: server.id,
        protocol: 'TCP',
        sizeBytes: 1460,
        count: 1,
        flowColor: '#059669'
      })
    }
  }

  // Add Device from Cisco Palette
  const handleAddDevice = (type) => {
    if (!engineRef.current) return
    const offset = (engineRef.current.topology.nodes.length % 5) * 60
    engineRef.current.addNode({
      type: type === 'bottleneck_router' ? 'router' : type,
      isBottleneck: type === 'bottleneck_router',
      x: 220 + offset,
      y: 160 + offset
    })
    setTickCounter(c => c + 1)
  }

  const engine = engineRef.current
  const inFlightCount = engine?.packets?.length || 0
  const history = engine?.telemetryHistory || []
  const latestTelemetry = history.length > 0 ? history[history.length - 1] : {}

  // Active packet for Demonstration ticker
  const activePkt = engine?.packets?.[0] || null
  const activeSrcNode = activePkt ? engine?.nodeMap?.get(activePkt.srcNode) : null
  const activeDstNode = activePkt ? engine?.nodeMap?.get(activePkt.dstNode) : null
  const activeHopU = activePkt ? engine?.nodeMap?.get(activePkt.path?.[activePkt.hopIndex]) : null
  const activeHopV = activePkt ? engine?.nodeMap?.get(activePkt.path?.[activePkt.hopIndex + 1]) : null

  const SPEED_PRESETS = [
    { label: '0.01x (Micro)', val: 0.01 },
    { label: '0.05x (Super Slow)', val: 0.05 },
    { label: '0.1x (Slow-Mo)', val: 0.1 },
    { label: '0.5x (Half)', val: 0.5 },
    { label: '1.0x (Normal)', val: 1.0 },
    { label: '5.0x (Fast)', val: 5.0 },
    { label: '20x (Stress)', val: 20.0 },
    { label: '100x (Hyper)', val: 100.0 }
  ]

  const DOCK_PRESETS = [
    { label: 'Compact', h: 180 },
    { label: 'Medium', h: 240 },
    { label: 'Tall', h: 350 }
  ]

  return (
    <div className={`w-screen h-screen flex flex-col font-sans select-none overflow-hidden transition-colors duration-200 ${
      isDark ? 'bg-[#070b14] text-slate-100' : 'bg-slate-100 text-slate-800'
    }`}>
      {/* 1. TOP COMMAND BAR */}
      <header className={`h-14 border-b px-4 flex items-center justify-between gap-3 z-30 shrink-0 shadow-sm transition-colors ${
        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-800'
      }`}>
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-sky-500 to-emerald-500 p-0.5 flex items-center justify-center shadow">
            <div className={`w-full h-full rounded-md flex items-center justify-center font-black text-xs font-mono ${
              isDark ? 'bg-slate-950 text-cyan-400' : 'bg-white text-cyan-700'
            }`}>
              CPT
            </div>
          </div>
          <div>
            <h1 className="font-bold text-xs sm:text-sm tracking-wide flex items-center gap-2">
              CISCO PACKET TRACER & SIMULATOR
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                isDark ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300' : 'bg-cyan-50 border border-cyan-300 text-cyan-800'
              }`}>
                DEMO READY v3.3
              </span>
            </h1>
            <div className="text-[10px] text-slate-500 font-mono hidden md:block">
              Interactive Topology • Packet Transfer Visualizer • 0.01x to 100x
            </div>
          </div>
        </div>

        {/* Central Controls: Topology & Algorithm Selectors */}
        <div className="flex items-center gap-2">
          {/* Topology Selector */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-300'
          }`}>
            <Network size={14} className="text-cyan-600" />
            <select
              value={topologyKey}
              onChange={(e) => setTopologyKey(e.target.value)}
              className="bg-transparent font-mono focus:outline-none cursor-pointer max-w-[150px] sm:max-w-none truncate font-semibold"
            >
              {Object.values(TOPOLOGIES).map(topo => (
                <option key={topo.id} value={topo.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>
                  {topo.name}
                </option>
              ))}
            </select>
          </div>

          {/* Algorithm Selector */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-300'
          }`}>
            <Cpu size={14} className="text-emerald-600" />
            <select
              value={algorithmKey}
              onChange={(e) => setAlgorithmKey(e.target.value)}
              className="bg-transparent font-mono focus:outline-none cursor-pointer max-w-[130px] sm:max-w-none truncate font-semibold"
            >
              {Object.values(ALGORITHMS).map(algo => (
                <option key={algo.id} value={algo.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>
                  {algo.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls: Play/Pause, Step, Speed, Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
            <span>{isRunning ? 'Pause' : 'Play'}</span>
          </button>

          {/* Step Discrete Event */}
          <button
            onClick={handleStep}
            className={`p-1.5 rounded-lg border text-xs transition ${
              isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
            title="Step One Event Forward"
          >
            <SkipForward size={14} />
          </button>

          {/* Step +15% Hop Progress */}
          <button
            onClick={handleStepHop}
            className={`px-2 py-1.5 rounded-lg border text-xs font-bold font-mono transition flex items-center gap-1 ${
              isDark ? 'bg-slate-900 border-slate-800 text-cyan-400 hover:bg-slate-800' : 'bg-cyan-50 border-cyan-300 text-cyan-800 hover:bg-cyan-100 shadow-sm'
            }`}
            title="Demonstration Step: Advance packet by +15% link progress"
          >
            <FastForward size={13} />
            <span>+15% Hop</span>
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className={`p-1.5 rounded-lg border text-xs transition ${
              isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
            title="Reset Simulation State"
          >
            <RotateCcw size={14} />
          </button>

          {/* Inject Traffic Spike */}
          <button
            onClick={handleInjectSpike}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
              isDark
                ? 'bg-red-950/70 border-red-500/50 hover:bg-red-900/60 text-red-300'
                : 'bg-red-50 border-red-300 hover:bg-red-100 text-red-700 font-bold'
            }`}
            title="Inject sudden burst of 20 packets to induce buffer congestion"
          >
            <Zap size={14} className="text-red-500" />
            <span className="hidden xl:inline">Inject Spike</span>
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 font-mono font-bold ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800'
                : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            <span className="hidden sm:inline">{isDark ? 'Dark' : 'Light'}</span>
          </button>

          {/* Settings Drawer Toggle */}
          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className={`p-1.5 rounded-lg border text-xs transition ${
              showSettingsDrawer
                ? 'bg-cyan-600 text-white border-cyan-600 shadow'
                : (isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-200')
            }`}
            title="Dynamic Link & Queue Tuning"
          >
            <SlidersHorizontal size={15} />
          </button>

          {/* Compare Report Modal Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow"
          >
            <BarChart3 size={14} />
            <span className="hidden sm:inline">Audit Report</span>
          </button>
        </div>
      </header>

      {/* 2. SUB-HEADER TELEMETRY TICKER */}
      <div className={`h-8 border-b px-4 flex items-center justify-between text-xs font-mono shrink-0 transition-colors ${
        isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span>Envelopes in Flight: <strong className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>{inFlightCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Throughput: <strong className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>{latestTelemetry.throughput || '0.00'} Mbps</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>CWND: <strong className={isDark ? 'text-sky-300' : 'text-sky-700'}>{latestTelemetry.cwnd || '1.0'} pkts</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>RTT: <strong className={isDark ? 'text-amber-300' : 'text-amber-700'}>{latestTelemetry.rtt || '30.0'} ms</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Queue Load: <strong className={isDark ? 'text-purple-300' : 'text-purple-700'}>{latestTelemetry.queueOccupancy || '0.0'}%</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-bold text-cyan-700">Speed: {speed < 1 ? `${speed}x (${(speed * 100).toFixed(0)}%)` : `${speed}x`}</span>
          <span className="text-slate-400">|</span>
          <span>Bottleneck: <strong>{bottleneckBw} Mbps</strong> ({bottleneckBuffer} buffer)</span>
          <span className="text-slate-400">|</span>

          {/* Graph Adjust Height Control */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 hidden sm:inline">Graph:</span>
            {DOCK_PRESETS.map(dp => (
              <button
                key={dp.h}
                onClick={() => {
                  setDockHeight(dp.h)
                  if (!showTelemetryDock) setShowTelemetryDock(true)
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition border ${
                  dockHeight === dp.h && showTelemetryDock
                    ? 'bg-cyan-600 text-white font-bold border-cyan-600'
                    : (isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100')
                }`}
                title={`Set telemetry graph height to ${dp.h}px`}
              >
                {dp.label}
              </button>
            ))}
          </div>

          <span className="text-slate-400">|</span>

          {/* Toggle Telemetry Dock */}
          <button
            onClick={() => setShowTelemetryDock(!showTelemetryDock)}
            className="hover:text-cyan-600 flex items-center gap-1 cursor-pointer font-bold"
            title="Toggle Live Telemetry Charts Dock"
          >
            <span>{showTelemetryDock ? 'Hide Graph' : 'Show Graph'}</span>
            {showTelemetryDock ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* 3. 🎓 DEMONSTRATION & SPEED WALKTHROUGH BAR (0.01x to 100x Speed Slider + Live Explainer) */}
      <div className={`border-b px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono transition-colors shadow-sm shrink-0 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        {/* Live Packet Transfer Explainer */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="text-[11px] truncate">
            {activePkt ? (
              <span>
                <strong className="text-emerald-700 font-bold">
                  {activePkt.isAck ? `ACK #${activePkt.ack}` : `${activePkt.protocol || 'TCP'} #${activePkt.seq}`}:
                </strong>{' '}
                {activePkt.queuedAtRouter ? (
                  <span className="text-amber-700 font-semibold">
                    Queued at Router [{activeHopU?.name || 'Router'}] buffer waiting for transmission...
                  </span>
                ) : (
                  <span>
                    Moving from <strong>{activeHopU?.name || 'Device'}</strong> ➔ <strong>{activeHopV?.name || 'Next Device'}</strong>{' '}
                    (Transfer Progress: <strong className="text-cyan-700 font-bold">{Math.min(100, Math.max(0, (activePkt.progress || 0) * 100)).toFixed(1)}%</strong>)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-500">
                💡 Ready for demonstration! Click <strong>"Send Demo Packet"</strong> to observe step-by-step transfer.
              </span>
            )}
          </div>
        </div>

        {/* Demonstration Speed Controller (0.01x Micro to 100x Hyper) */}
        <div className="flex items-center gap-3">
          {/* Quick Demo Action Buttons */}
          <button
            onClick={handleSendDemoPacket}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition"
            title="Fire a single demonstration packet across the bottleneck path"
          >
            <span>✉️</span>
            <span>Send Demo Packet</span>
          </button>

          {/* Speed Presets */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-[10px] font-bold hidden xl:inline">Speed Presets:</span>
            {SPEED_PRESETS.map(sp => (
              <button
                key={sp.val}
                onClick={() => setSpeed(sp.val)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition border ${
                  speed === sp.val
                    ? 'bg-cyan-600 text-white font-bold border-cyan-600 shadow-sm'
                    : (isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-200')
                }`}
                title={`Demonstration Speed: ${sp.label}`}
              >
                {sp.val}x
              </button>
            ))}
          </div>

          {/* Continuous Demonstration Speed Slider: 0.01x to 100x */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
            <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
              Fine Speed: <strong className="text-cyan-700">{speed < 1 ? `${speed}x` : `${speed.toFixed(0)}x`}</strong>
            </span>
            <input
              type="range"
              min="0.01"
              max="20"
              step="0.01"
              value={speed > 20 ? 20 : speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-24 accent-cyan-600 cursor-pointer"
              title="Continuous speed slider from 0.01x (Micro slow-mo) to 100x"
            />
          </div>
        </div>
      </div>

      {/* 4. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Canvas Area */}
        <div className="flex-1 relative min-h-[240px]">
          {engine && (
            <NetworkCanvas
              engine={engine}
              activeTool={activeTool}
              cableSourceNode={cableSourceNode}
              setCableSourceNode={setCableSourceNode}
              pduSourceNode={pduSourceNode}
              setPduSourceNode={setPduSourceNode}
              onSelectNode={(node) => setSelectedNode(node)}
              onInspectPacket={(pkt) => setInspectingPacket(pkt)}
              isDark={isDark}
            />
          )}

          {/* Floating Settings Drawer on Right */}
          {showSettingsDrawer && (
            <div className={`absolute top-4 right-4 w-80 rounded-2xl p-4 shadow-2xl backdrop-blur-md z-30 space-y-4 border animate-in slide-in-from-right transition-colors ${
              isDark ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-300 text-slate-800'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-cyan-600">
                  <SlidersHorizontal size={14} /> Network Dynamics Controls
                </h3>
                <button
                  onClick={() => setShowSettingsDrawer(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              {/* Demonstration Speed in Drawer */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-500 font-bold">Demonstration Speed</span>
                  <span className="text-cyan-700 font-bold">{speed}x ({(speed * 100).toFixed(0)}%)</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="10"
                  step="0.01"
                  value={speed > 10 ? 10 : speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>0.01x (Micro)</span>
                  <span>1.0x (Realtime)</span>
                  <span>10.0x (Fast)</span>
                </div>
              </div>

              {/* Bottleneck Bandwidth */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-500 font-bold">Bottleneck Bandwidth</span>
                  <span className="text-cyan-700 font-bold">{bottleneckBw} Mbps</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="100"
                  step="2"
                  value={bottleneckBw}
                  onChange={(e) => setBottleneckBw(parseInt(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              {/* Bottleneck Buffer Capacity */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-500 font-bold">Router Buffer Queue Size</span>
                  <span className="text-amber-700 font-bold">{bottleneckBuffer} packets</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="60"
                  step="2"
                  value={bottleneckBuffer}
                  onChange={(e) => setBottleneckBuffer(parseInt(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              {/* Router Queue Policy (Tail Drop vs RED) */}
              <div>
                <label className="block text-slate-500 text-xs font-mono mb-1 font-bold">Queue Discipline</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setQueuePolicy('TAIL_DROP')}
                    className={`py-1.5 px-2 rounded border font-mono transition font-bold ${
                      queuePolicy === 'TAIL_DROP'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-800 shadow-sm'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    FIFO Tail-Drop
                  </button>
                  <button
                    onClick={() => setQueuePolicy('RED')}
                    className={`py-1.5 px-2 rounded border font-mono transition font-bold ${
                      queuePolicy === 'RED'
                        ? 'bg-purple-50 border-purple-500 text-purple-800 shadow-sm'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    RED (AQM)
                  </button>
                </div>
              </div>

              {/* Background Wireless/Random Loss */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-500 font-bold">Random Channel Loss</span>
                  <span className="text-red-700 font-bold">{randomLossRate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={randomLossRate}
                  onChange={(e) => setRandomLossRate(parseFloat(e.target.value))}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>

              {/* Graph Dock Height Adjuster Slider */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-500 font-bold">Telemetry Graph Height</span>
                  <span className="text-cyan-700 font-bold">{dockHeight}px</span>
                </div>
                <input
                  type="range"
                  min="160"
                  max="420"
                  step="10"
                  value={dockHeight}
                  onChange={(e) => {
                    setDockHeight(parseInt(e.target.value))
                    if (!showTelemetryDock) setShowTelemetryDock(true)
                  }}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic & Adjustable Telemetry Dock */}
        {showTelemetryDock && (
          <div
            style={{ height: `${dockHeight}px` }}
            className={`border-t p-2 shrink-0 transition-all duration-150 ${
              isDark ? 'border-slate-800 bg-slate-950/90' : 'border-slate-300 bg-slate-100'
            }`}
          >
            <TelemetryCharts
              history={history}
              currentAlgo={ALGORITHMS[algorithmKey]?.name || algorithmKey}
              isDark={isDark}
            />
          </div>
        )}
      </div>

      {/* 5. CISCO PACKET TRACER BOTTOM DEVICE RACK */}
      <CiscoDevicePalette
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onAddDevice={handleAddDevice}
        onOpenCustomPdu={() => setShowCustomPduModal(true)}
        cableSourceNode={cableSourceNode}
        pduSourceNode={pduSourceNode}
        isDark={isDark}
      />

      {/* 6. MODALS */}
      {/* Node Inspector Modal */}
      {selectedNode && (
        <NodeInspectorModal
          node={selectedNode}
          engine={engine}
          onClose={() => setSelectedNode(null)}
          isDark={isDark}
        />
      )}

      {/* Cisco PDU Packet Inspector Modal */}
      {inspectingPacket && (
        <PduInspectorModal
          packet={inspectingPacket}
          onClose={() => setInspectingPacket(null)}
          isDark={isDark}
        />
      )}

      {/* Packet Crafter & Custom PDU Generator Modal */}
      {showCustomPduModal && (
        <PacketCustomizerModal
          engine={engine}
          isOpen={showCustomPduModal}
          onClose={() => setShowCustomPduModal(false)}
          isDark={isDark}
        />
      )}

      {/* File Comparator & Full Simulation Report Modal */}
      {showReportModal && (
        <FileComparatorReportModal
          engine={engine}
          onClose={() => setShowReportModal(false)}
          isDark={isDark}
        />
      )}
    </div>
  )
}
