import React, { useState, useRef, useEffect } from 'react'
import { Activity, Zap, Clock, Database } from 'lucide-react'

export default function TelemetryCharts({ history = [], currentAlgo = 'TCP Reno', isDark = false }) {
  const containerRef = useRef(null)
  const [activeMetric, setActiveMetric] = useState('ALL') // 'ALL', 'CWND', 'THROUGHPUT', 'RTT', 'QUEUE'
  const [timeWindow, setTimeWindow] = useState('ALL') // '20', '40', '60', 'ALL'
  const [autoScale, setAutoScale] = useState(true)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [dims, setDims] = useState({ width: 900, height: 160 })

  // Dynamically measure container size on resize
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
  }, [])

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

  // Chart Layout Padding & Plots
  const padding = { top: 15, right: 30, bottom: 25, left: 45 }
  const plotWidth = Math.max(100, dims.width - padding.left - padding.right)
  const plotHeight = Math.max(60, dims.height - padding.top - padding.bottom)

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

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - padding.left
    const ratio = Math.max(0, Math.min(1, mouseX / plotWidth))
    const index = Math.round(ratio * (displayHistory.length - 1))
    setHoverIndex(index)
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  return (
    <div className={`w-full h-full flex flex-col rounded-xl border p-3 select-none transition-colors duration-200 ${
      isDark
        ? 'bg-slate-900 border-slate-800 text-slate-100'
        : 'bg-white border-slate-300 text-slate-800 shadow-sm'
    }`}>
      {/* 1. Header Toolbar: Metrics + Range Adjuster */}
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

        {/* Adjusting Controls */}
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
        </div>
      </div>

      {/* 2. Real-time KPI Cards */}
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

      {/* 3. Fully Responsive & Auto-Adjusting SVG Graph Area */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full min-h-[90px] select-none cursor-crosshair overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          width={dims.width}
          height={dims.height}
          className="w-full h-full block"
        >
          {/* Subtle Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padding.top + plotHeight * pct
            return (
              <line
                key={pct}
                x1={padding.left}
                y1={y}
                x2={dims.width - padding.right}
                y2={y}
                stroke={isDark ? '#1e293b' : '#e2e8f0'}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            )
          })}

          {/* Plot Series Lines */}
          {(activeMetric === 'ALL' || activeMetric === 'CWND') && (
            <path
              d={makePath('cwnd', maxCwnd)}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
            />
          )}

          {(activeMetric === 'ALL' || activeMetric === 'THROUGHPUT') && (
            <path
              d={makePath('throughput', maxThpt)}
              fill="none"
              stroke="#059669"
              strokeWidth="2"
            />
          )}

          {(activeMetric === 'ALL' || activeMetric === 'RTT') && (
            <path
              d={makePath('rtt', maxRtt)}
              fill="none"
              stroke="#d97706"
              strokeWidth="1.8"
              strokeDasharray={activeMetric === 'ALL' ? '4 3' : 'none'}
            />
          )}

          {(activeMetric === 'ALL' || activeMetric === 'QUEUE') && (
            <path
              d={makePath('queueOccupancy', maxQueue)}
              fill="none"
              stroke="#7c3aed"
              strokeWidth="1.8"
            />
          )}

          {/* Hover Scrubbing Line */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={dims.height - padding.bottom}
                stroke={isDark ? '#f8fafc' : '#334155'}
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(hoveredPoint.cwnd || 0, maxCwnd)}
                r="4.5"
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X Axis Time Labels */}
          <text
            x={padding.left}
            y={dims.height - 6}
            fill={isDark ? '#64748b' : '#94a3b8'}
            fontSize="10"
            fontFamily="monospace"
          >
            {displayHistory[0]?.time}s
          </text>
          <text
            x={dims.width - padding.right}
            y={dims.height - 6}
            fill={isDark ? '#64748b' : '#94a3b8'}
            fontSize="10"
            fontFamily="monospace"
            textAnchor="end"
          >
            {latest?.time}s
          </text>

          {/* Y Axis Max Label */}
          <text
            x={padding.left - 5}
            y={padding.top + 10}
            fill={isDark ? '#64748b' : '#94a3b8'}
            fontSize="9"
            fontFamily="monospace"
            textAnchor="end"
          >
            {activeMetric === 'CWND' ? `${maxCwnd.toFixed(0)}pk` : activeMetric === 'THROUGHPUT' ? `${maxThpt.toFixed(0)}M` : activeMetric === 'RTT' ? `${maxRtt.toFixed(0)}ms` : `${maxCwnd.toFixed(0)}pk`}
          </text>
        </svg>
      </div>

      {/* 4. Legend Footer */}
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
        <span>Points: {filteredHistory.length} | Sampling: 400ms</span>
      </div>
    </div>
  )
}
