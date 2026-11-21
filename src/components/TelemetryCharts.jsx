import React, { useState, useRef, useEffect } from 'react'
import {
  Activity, Zap, Clock, Database, Maximize2, Minimize2,
  BarChart2
} from 'lucide-react'

export default function TelemetryCharts({ history = [], currentAlgo = 'TCP Reno', isDark = false }) {
  const containerRef = useRef(null)
  const fullScreenContainerRef = useRef(null)
  const [activeMetric, setActiveMetric] = useState('ALL') // 'ALL', 'CWND', 'THROUGHPUT', 'RTT', 'QUEUE'
  const [timeWindow, setTimeWindow] = useState('ALL') // '20', '40', '60', 'ALL'
  const [autoScale, setAutoScale] = useState(true)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [dims, setDims] = useState({ width: 900, height: 160 })
  const [fsDims, setFsDims] = useState({ width: 1200, height: 600 })

  // Escape key listener to exit full screen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullScreen])

  // Measure embedded container size on resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateDims = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 50 && rect.height > 50) {
        setDims({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height)
        })
      }
    }

    updateDims()
    const observer = new ResizeObserver(updateDims)
    observer.observe(el)
    window.addEventListener('resize', updateDims)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateDims)
    }
  }, [isFullScreen])

  // Measure full screen container size on resize
  useEffect(() => {
    if (!isFullScreen) return
    const el = fullScreenContainerRef.current
    if (!el) return

    const updateFsDims = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 100 && rect.height > 100) {
        setFsDims({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height)
        })
      }
    }

    updateFsDims()
    const observer = new ResizeObserver(updateFsDims)
    observer.observe(el)
    window.addEventListener('resize', updateFsDims)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateFsDims)
    }
  }, [isFullScreen])

  // Filter history based on time window
  const filteredHistory = React.useMemo(() => {
    if (!history || history.length === 0) return []
    if (timeWindow === 'ALL') return history
    const seconds = parseInt(timeWindow, 10)
    const latestTime = history[history.length - 1]?.time || 0
    const cutoff = Math.max(0, latestTime - seconds)
    const sliced = history.filter(d => (d.time || 0) >= cutoff)
    return sliced.length >= 2 ? sliced : history.slice(-Math.min(history.length, seconds * 2))
  }, [history, history?.length, timeWindow])

  // Ensure there are always points to display so graph is immediately active
  const displayHistory = React.useMemo(() => {
    if (!filteredHistory || filteredHistory.length === 0) {
      return [
        { time: 0, cwnd: 2, throughput: 0.5, rtt: 35, queueOccupancy: 0 },
        { time: 0.5, cwnd: 2, throughput: 0.5, rtt: 35, queueOccupancy: 0 }
      ]
    }
    if (filteredHistory.length === 1) {
      return [
        { ...filteredHistory[0], time: Math.max(0, (filteredHistory[0].time || 0) - 0.5) },
        filteredHistory[0]
      ]
    }
    return filteredHistory
  }, [filteredHistory])

  const latest = displayHistory[displayHistory.length - 1]
  const hoveredPoint = hoverIndex !== null && displayHistory[hoverIndex] ? displayHistory[hoverIndex] : latest

  // Render SVG Chart with comprehensive coordinates (used in both embedded and fullscreen)
  const renderSvgChart = (chartDims, isFsMode = false) => {
    // Generous coordinate padding so values and axis titles never clip
    const padding = isFsMode
      ? { top: 32, right: 40, bottom: 48, left: 75 }
      : { top: 26, right: 30, bottom: 40, left: 65 }

    const plotWidth = Math.max(100, chartDims.width - padding.left - padding.right)
    const plotHeight = Math.max(60, chartDims.height - padding.top - padding.bottom)

    // Auto-Adjusting Y-axis scales
    const maxCwnd = autoScale ? Math.max(8, ...displayHistory.map(d => d.cwnd || 0)) * 1.15 : 64
    const maxThpt = autoScale ? Math.max(10, ...displayHistory.map(d => d.throughput || 0)) * 1.15 : 100
    const maxRtt = autoScale ? Math.max(40, ...displayHistory.map(d => d.rtt || 0)) * 1.15 : 200
    const maxQueue = 100

    const getX = (idx) => padding.left + (idx / Math.max(1, displayHistory.length - 1)) * plotWidth
    const getY = (val, maxVal) => padding.top + plotHeight - (Math.min(maxVal, Math.max(0, val)) / Math.max(1, maxVal)) * plotHeight

    // Path generator
    const makePath = (dataKey, maxVal) => {
      return displayHistory.reduce((acc, pt, i) => {
        const x = getX(i)
        const y = getY(pt[dataKey] || 0, maxVal)
        return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`
      }, '')
    }

    // Generate 5 Y-Axis Ticks & Labels
    const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(pct => {
      let valLabel = `${(pct * 100).toFixed(0)}%`
      if (activeMetric === 'CWND') valLabel = `${(maxCwnd * pct).toFixed(0)} pk`
      else if (activeMetric === 'THROUGHPUT') valLabel = `${(maxThpt * pct).toFixed(1)} M`
      else if (activeMetric === 'RTT') valLabel = `${(maxRtt * pct).toFixed(0)} ms`
      else if (activeMetric === 'QUEUE') valLabel = `${(maxQueue * pct).toFixed(0)}%`
      else if (activeMetric === 'ALL') valLabel = `${(pct * 100).toFixed(0)}% (${(maxCwnd * pct).toFixed(0)}pk)`
      return { pct, valLabel }
    })

    // Generate 5 to 7 X-Axis Time Ticks
    const xTicksCount = chartDims.width > 700 ? 7 : 5
    const minTime = displayHistory[0]?.time || 0
    const maxTime = displayHistory[displayHistory.length - 1]?.time || 0
    const timeSpan = Math.max(0.1, maxTime - minTime)

    const xTicks = Array.from({ length: xTicksCount }, (_, i) => {
      const ratio = i / (xTicksCount - 1)
      const timeVal = minTime + ratio * timeSpan
      const xPos = padding.left + ratio * plotWidth
      return { timeVal, xPos }
    })

    const handleMouseMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mouseX = e.clientX - rect.left - padding.left
      const ratio = Math.max(0, Math.min(1, mouseX / plotWidth))
      const index = Math.round(ratio * (displayHistory.length - 1))
      setHoverIndex(index)
    }

    const yAxisTitle = activeMetric === 'ALL'
      ? '▲ Y-AXIS: MULTI-METRIC SCALE (0% - 100% NORMALIZED)'
      : activeMetric === 'CWND'
      ? '▲ Y-AXIS: CONGESTION WINDOW (PACKETS)'
      : activeMetric === 'THROUGHPUT'
      ? '▲ Y-AXIS: BANDWIDTH THROUGHPUT (MBPS)'
      : activeMetric === 'RTT'
      ? '▲ Y-AXIS: ROUND TRIP TIME LATENCY (MS)'
      : '▲ Y-AXIS: ROUTER QUEUE OCCUPANCY (%)'

    return (
      <svg
        width={chartDims.width}
        height={chartDims.height}
        className="w-full h-full block cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Subtle Background Plot Area */}
        <rect
          x={padding.left}
          y={padding.top}
          width={plotWidth}
          height={plotHeight}
          fill={isDark ? '#0b111e' : '#f8fafc'}
          rx="4"
        />

        {/* 1. Y-AXIS TICKS & HORIZONTAL GRID LINES */}
        {yTicks.map(({ pct, valLabel }) => {
          const y = padding.top + plotHeight * (1 - pct)
          return (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + plotWidth}
                y2={y}
                stroke={isDark ? '#1e293b' : '#e2e8f0'}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={padding.left - 6}
                y1={y}
                x2={padding.left}
                y2={y}
                stroke={isDark ? '#64748b' : '#94a3b8'}
                strokeWidth="1.5"
              />
              <text
                x={padding.left - 9}
                y={y + 3.5}
                fill={isDark ? '#94a3b8' : '#64748b'}
                fontSize={isFsMode ? '11' : '10'}
                fontFamily="monospace"
                fontWeight="500"
                textAnchor="end"
              >
                {valLabel}
              </text>
            </g>
          )
        })}

        {/* 2. X-AXIS TICKS & VERTICAL GRID LINES */}
        {xTicks.map(({ timeVal, xPos }, idx) => (
          <g key={idx}>
            <line
              x1={xPos}
              y1={padding.top}
              x2={xPos}
              y2={padding.top + plotHeight}
              stroke={isDark ? '#1e293b' : '#f1f5f9'}
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <line
              x1={xPos}
              y1={padding.top + plotHeight}
              x2={xPos}
              y2={padding.top + plotHeight + 6}
              stroke={isDark ? '#64748b' : '#94a3b8'}
              strokeWidth="1.5"
            />
            <text
              x={xPos}
              y={padding.top + plotHeight + 18}
              fill={isDark ? '#94a3b8' : '#64748b'}
              fontSize={isFsMode ? '11' : '10'}
              fontFamily="monospace"
              fontWeight="500"
              textAnchor="middle"
            >
              {timeVal.toFixed(1)}s
            </text>
          </g>
        ))}

        {/* 3. SOLID AXIS BASELINES */}
        {/* Y Axis Baseline */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          stroke={isDark ? '#475569' : '#94a3b8'}
          strokeWidth="2"
        />
        {/* X Axis Baseline */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke={isDark ? '#475569' : '#94a3b8'}
          strokeWidth="2"
        />

        {/* 4. CLEAR BOLD AXIS TITLE LABELS */}
        {/* Y-Axis Title */}
        <text
          x={padding.left}
          y={padding.top - 10}
          fill={isDark ? '#38bdf8' : '#0369a1'}
          fontSize={isFsMode ? '11' : '10'}
          fontFamily="monospace"
          fontWeight="bold"
        >
          {yAxisTitle}
        </text>

        {/* X-Axis Title */}
        <text
          x={padding.left + plotWidth / 2}
          y={padding.top + plotHeight + (isFsMode ? 38 : 34)}
          fill={isDark ? '#38bdf8' : '#0369a1'}
          fontSize={isFsMode ? '11' : '10'}
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          ➔ X-AXIS: SIMULATION TIME (SECONDS)
        </text>

        {/* 5. METRIC SERIES LINES */}
        {(activeMetric === 'ALL' || activeMetric === 'CWND') && (
          <path
            d={makePath('cwnd', maxCwnd)}
            fill="none"
            stroke="#0284c7"
            strokeWidth={isFsMode ? '3.5' : '2.5'}
          />
        )}

        {(activeMetric === 'ALL' || activeMetric === 'THROUGHPUT') && (
          <path
            d={makePath('throughput', maxThpt)}
            fill="none"
            stroke="#059669"
            strokeWidth={isFsMode ? '3' : '2'}
          />
        )}

        {(activeMetric === 'ALL' || activeMetric === 'RTT') && (
          <path
            d={makePath('rtt', maxRtt)}
            fill="none"
            stroke="#d97706"
            strokeWidth={isFsMode ? '2.5' : '1.8'}
            strokeDasharray={activeMetric === 'ALL' ? '4 3' : 'none'}
          />
        )}

        {(activeMetric === 'ALL' || activeMetric === 'QUEUE') && (
          <path
            d={makePath('queueOccupancy', maxQueue)}
            fill="none"
            stroke="#7c3aed"
            strokeWidth={isFsMode ? '2.5' : '1.8'}
          />
        )}

        {/* 6. HOVER CROSSHAIRS & EXACT COORDINATES TOOLTIP */}
        {hoverIndex !== null && (
          <g>
            {/* Vertical crosshair guide */}
            <line
              x1={getX(hoverIndex)}
              y1={padding.top}
              x2={getX(hoverIndex)}
              y2={padding.top + plotHeight}
              stroke={isDark ? '#f8fafc' : '#334155'}
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />

            {/* Horizontal crosshair guide */}
            <line
              x1={padding.left}
              y1={getY(hoveredPoint.cwnd || 0, maxCwnd)}
              x2={padding.left + plotWidth}
              y2={getY(hoveredPoint.cwnd || 0, maxCwnd)}
              stroke="#0284c7"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.6"
            />

            {/* Hover circle on CWND point */}
            <circle
              cx={getX(hoverIndex)}
              cy={getY(hoveredPoint.cwnd || 0, maxCwnd)}
              r="5"
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Floating Coordinate Pill Near Cursor */}
            <g
              transform={`translate(${
                getX(hoverIndex) + 15 > padding.left + plotWidth - 170
                  ? getX(hoverIndex) - 175
                  : getX(hoverIndex) + 12
              }, ${
                getY(hoveredPoint.cwnd || 0, maxCwnd) - 45 < padding.top
                  ? padding.top + 10
                  : getY(hoveredPoint.cwnd || 0, maxCwnd) - 45
              })`}
            >
              <rect
                width="165"
                height="48"
                rx="6"
                fill={isDark ? '#0f172a' : '#1e293b'}
                stroke={isDark ? '#38bdf8' : '#0284c7'}
                strokeWidth="1.5"
                filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
              />
              <text x="8" y="16" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                X: {hoveredPoint.time?.toFixed(1)}s (Time)
              </text>
              <text x="8" y="29" fill="#ffffff" fontSize="9" fontFamily="monospace">
                Y: cwnd={hoveredPoint.cwnd}pk | thpt={hoveredPoint.throughput}M
              </text>
              <text x="8" y="41" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                rtt={hoveredPoint.rtt}ms | queue={hoveredPoint.queueOccupancy}%
              </text>
            </g>
          </g>
        )}
      </svg>
    )
  }

  // Shared KPI Summary Cards
  const renderKpiCards = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2 text-xs font-mono">
      <div className={`p-2 rounded-lg border flex items-center justify-between ${
        isDark ? 'bg-slate-950/60 border-cyan-500/30' : 'bg-cyan-50/60 border-cyan-200'
      }`}>
        <div>
          <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
            Congestion Window (cwnd)
          </div>
          <div className={`text-base font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-900'}`}>
            {hoveredPoint.cwnd?.toFixed(1) || 0} <span className="text-xs font-normal text-slate-400">pkts</span>
          </div>
        </div>
        <Zap size={18} className="text-cyan-500" />
      </div>

      <div className={`p-2 rounded-lg border flex items-center justify-between ${
        isDark ? 'bg-slate-950/60 border-emerald-500/30' : 'bg-emerald-50/60 border-emerald-200'
      }`}>
        <div>
          <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
            Throughput
          </div>
          <div className={`text-base font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-900'}`}>
            {hoveredPoint.throughput?.toFixed(2) || 0} <span className="text-xs font-normal text-slate-400">Mbps</span>
          </div>
        </div>
        <Activity size={18} className="text-emerald-500" />
      </div>

      <div className={`p-2 rounded-lg border flex items-center justify-between ${
        isDark ? 'bg-slate-950/60 border-amber-500/30' : 'bg-amber-50/60 border-amber-200'
      }`}>
        <div>
          <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
            Round Trip Time (RTT)
          </div>
          <div className={`text-base font-bold ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
            {hoveredPoint.rtt?.toFixed(1) || 0} <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
        </div>
        <Clock size={18} className="text-amber-500" />
      </div>

      <div className={`p-2 rounded-lg border flex items-center justify-between ${
        isDark ? 'bg-slate-950/60 border-purple-500/30' : 'bg-purple-50/60 border-purple-200'
      }`}>
        <div>
          <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
            Queue Occupancy
          </div>
          <div className={`text-base font-bold ${isDark ? 'text-purple-300' : 'text-purple-900'}`}>
            {hoveredPoint.queueOccupancy?.toFixed(1) || 0}%
          </div>
        </div>
        <Database size={18} className="text-purple-500" />
      </div>
    </div>
  )

  // Shared Toolbar Controls
  const renderToolbarControls = (isFs = false) => (
    <div className="flex items-center gap-2">
      {/* Time Window Adjuster */}
      <div className="flex items-center gap-1 text-[11px] font-mono">
        <span className="text-slate-400 hidden sm:inline">Range:</span>
        {[
          { id: '20', label: '20s' },
          { id: '40', label: '40s' },
          { id: '60', label: '60s' },
          { id: 'ALL', label: 'All' }
        ].map((rng) => (
          <button
            key={rng.id}
            onClick={() => setTimeWindow(rng.id)}
            className={`px-2 py-0.5 rounded transition ${
              timeWindow === rng.id
                ? (isDark ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-cyan-600 text-white font-bold')
                : (isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
            }`}
            title={`Show last ${rng.label} of telemetry`}
          >
            {rng.label}
          </button>
        ))}
      </div>

      {/* Auto-Scale Y-Axis Toggle */}
      <button
        onClick={() => setAutoScale(!autoScale)}
        className={`px-2 py-0.5 rounded text-[11px] font-mono transition border ${
          autoScale
            ? (isDark ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold')
            : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500')
        }`}
        title="Toggle Auto-Adjusting Y-Axis Scale"
      >
        {autoScale ? 'Auto-Fit: ON' : 'Auto-Fit: OFF'}
      </button>

      {/* Metric Selector Tabs */}
      <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border text-xs font-mono ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
      }`}>
        {['ALL', 'CWND', 'THROUGHPUT', 'RTT', 'QUEUE'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveMetric(tab)}
            className={`px-2 py-0.5 rounded transition font-medium ${
              activeMetric === tab
                ? (isDark ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'bg-white text-cyan-700 font-bold shadow')
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Full-Screen Toggle Button */}
      <button
        onClick={() => setIsFullScreen(!isFullScreen)}
        className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 transition shadow-sm ${
          isFs
            ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
            : (isDark ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700' : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-300')
        }`}
        title={isFs ? 'Exit Full Screen Mode (Esc)' : 'Open Full Screen Graph'}
      >
        {isFs ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        <span>{isFs ? 'Exit Fullscreen' : 'Fullscreen'}</span>
      </button>
    </div>
  )

  return (
    <>
      {/* ======================================================== */}
      {/* 1. EMBEDDED DOCK CHART VIEW */}
      {/* ======================================================== */}
      <div className={`w-full h-full flex flex-col rounded-xl border p-3 select-none transition-colors duration-200 ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-slate-300 text-slate-800 shadow-sm'
      }`}>
        {/* Header Toolbar */}
        <div className={`flex flex-wrap items-center justify-between pb-2 border-b gap-2 text-xs font-sans ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
              <h3 className="font-bold tracking-wide">LIVE TELEMETRY STREAM</h3>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
              isDark ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300' : 'bg-cyan-50 border border-cyan-300 text-cyan-700'
            }`}>
              {currentAlgo}
            </span>
          </div>

          {renderToolbarControls(false)}
        </div>

        {/* Real-time KPI Cards */}
        {renderKpiCards()}

        {/* Fully Responsive SVG Graph Area with Click-to-Fullscreen */}
        <div
          ref={containerRef}
          onClick={() => setIsFullScreen(true)}
          className="relative flex-1 w-full min-h-[90px] select-none cursor-pointer overflow-hidden group"
          title="Click to open Full-Screen Telemetry Graph"
        >
          {renderSvgChart(dims, false)}

          {/* Hover Overlay Badge Prompting Fullscreen */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900/80 text-white px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 shadow">
            <Maximize2 size={11} /> Click for Fullscreen Scope
          </div>
        </div>

        {/* Legend Footer */}
        <div className={`flex items-center justify-between pt-1.5 border-t text-[11px] font-mono ${
          isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
        }`}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-cyan-600 font-bold">
              <span className="w-2.5 h-0.5 bg-cyan-600" /> cwnd (Packets)
            </span>
            <span className="flex items-center gap-1 text-emerald-600 font-bold">
              <span className="w-2.5 h-0.5 bg-emerald-600" /> Throughput (Mbps)
            </span>
            <span className="flex items-center gap-1 text-amber-600 font-bold">
              <span className="w-2.5 h-0.5 bg-amber-600 border-dashed" /> RTT Latency (ms)
            </span>
            <span className="flex items-center gap-1 text-purple-600 font-bold">
              <span className="w-2.5 h-0.5 bg-purple-600" /> Queue Occupancy (%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Coordinates: X (Time in sec) • Y (Value)</span>
            <span className="text-slate-400">|</span>
            <span>Points: {filteredHistory.length}</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. FULL-SCREEN TELEMETRY MODAL OVERLAY */}
      {/* ======================================================== */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 p-4 sm:p-6 bg-black/75 backdrop-blur-md flex flex-col justify-center items-center animate-in fade-in duration-200">
          <div className={`w-full h-full max-w-7xl rounded-2xl flex flex-col border shadow-2xl overflow-hidden p-4 sm:p-6 transition-colors ${
            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
          }`}>
            {/* Fullscreen Header */}
            <div className={`flex flex-wrap items-center justify-between pb-3 border-b gap-3 shrink-0 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white font-bold shadow">
                  <BarChart2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold tracking-tight">
                      FULLSCREEN TELEMETRY ANALYZER — HIGH RESOLUTION METRIC OSCILLOSCOPE
                    </h2>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      isDark ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300' : 'bg-cyan-50 border border-cyan-300 text-cyan-700'
                    }`}>
                      {currentAlgo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Real-time coordinate tracking with millisecond precision and full-window scaling
                  </p>
                </div>
              </div>

              {renderToolbarControls(true)}
            </div>

            {/* Real-time KPI Cards */}
            {renderKpiCards()}

            {/* Fullscreen High-Resolution SVG Canvas Area */}
            <div
              ref={fullScreenContainerRef}
              className="relative flex-1 w-full min-h-[300px] select-none overflow-hidden my-2 border rounded-xl"
            >
              {renderSvgChart(fsDims, true)}
            </div>

            {/* Fullscreen Footer & Coordinate Legend */}
            <div className={`flex flex-wrap items-center justify-between pt-3 border-t text-xs font-mono shrink-0 ${
              isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-1.5 text-cyan-600 font-bold">
                  <span className="w-3.5 h-1 bg-cyan-600 rounded" /> Congestion Window (cwnd)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <span className="w-3.5 h-1 bg-emerald-600 rounded" /> Instantaneous Throughput (Mbps)
                </span>
                <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                  <span className="w-3.5 h-1 bg-amber-600 border-dashed rounded" /> Round Trip Time Latency (ms)
                </span>
                <span className="flex items-center gap-1.5 text-purple-600 font-bold">
                  <span className="w-3.5 h-1 bg-purple-600 rounded" /> Router Queue Depth (%)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-bold text-cyan-700">
                  📍 Hover anywhere on the chart to read exact (X, Y) coordinates
                </span>
                <button
                  onClick={() => setIsFullScreen(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 font-bold text-slate-800 dark:text-slate-100 transition"
                >
                  Exit Fullscreen (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
