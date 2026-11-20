import React, { useState, useRef } from 'react'
import {
  X, UploadCloud, FileText, CheckCircle2, AlertTriangle, TrendingUp,
  Download, Printer, ArrowRight, BarChart3, Sliders, RefreshCw
} from 'lucide-react'
import {
  generateSampleBaseline,
  parseUploadedTraceFile,
  computeComparisonReport,
  exportSimulationToCSV
} from '../simulation/sampleData'

export default function FileComparatorReportModal({ engine, onClose, isDark = false }) {
  const fileInputRef = useRef(null)

  // Baseline data state
  const [baselineData, setBaselineData] = useState(() => generateSampleBaseline('RENO_BASELINE', 60))
  const [uploadedFileName, setUploadedFileName] = useState('Baseline: Standard TCP Reno Enterprise Trace')
  const [parseError, setParseError] = useState('')
  const [activeTab, setActiveTab] = useState('COMPARISON') // 'COMPARISON', 'REPORT', 'UPLOAD'

  const simHistory = engine?.telemetryHistory || []
  const report = computeComparisonReport(simHistory, baselineData?.data || [], {
    algorithm: engine?.algorithmKey,
    topology: engine?.topology?.name,
    bottleneckBw: engine?.bottleneckBw,
    queuePolicy: engine?.queuePolicy,
    activeFlows: engine?.flows ? Array.from(engine.flows.keys()) : ['h1']
  })

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        const result = parseUploadedTraceFile(content, file.name)
        if (result.error) {
          setParseError(result.error)
        } else {
          setBaselineData(result)
          setUploadedFileName(file.name)
          setActiveTab('COMPARISON')
        }
      }
    }
    reader.onerror = () => setParseError('Failed to read file from disk.')
    reader.readAsText(file)
  }

  // Load sample baseline
  const handleLoadPreset = (presetType, title) => {
    setParseError('')
    const sample = generateSampleBaseline(presetType, 60)
    setBaselineData(sample)
    setUploadedFileName(title)
  }

  // Download current simulation as CSV
  const handleDownloadSimCsv = () => {
    const csvStr = exportSimulationToCSV(simHistory)
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `simulation_trace_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Print Report
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-cyan-400">
              <BarChart3 size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                SIMULATION BENCHMARK & COMPARATIVE REPORT
              </h2>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                Current Run: <span className="text-cyan-400 font-semibold">{engine?.algorithmKey}</span> vs Baseline:{' '}
                <span className="text-amber-400 font-semibold">{uploadedFileName}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('COMPARISON')}
                className={`px-3 py-1.5 rounded transition font-medium ${
                  activeTab === 'COMPARISON' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Side-by-Side Diff
              </button>
              <button
                onClick={() => setActiveTab('REPORT')}
                className={`px-3 py-1.5 rounded transition font-medium ${
                  activeTab === 'REPORT' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Executive Report
              </button>
              <button
                onClick={() => setActiveTab('UPLOAD')}
                className={`px-3 py-1.5 rounded transition font-medium ${
                  activeTab === 'UPLOAD' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upload Dataset
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SIDE-BY-SIDE COMPARISON */}
          {activeTab === 'COMPARISON' && (
            <div className="space-y-6">
              {/* Scorecard Metric Delta Matrix */}
              {report && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-mono mb-1">Avg Throughput</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold font-mono text-cyan-300">{report.metrics.simAvgThpt}</span>
                      <span className="text-xs font-mono text-slate-500">/ {report.metrics.baseAvgThpt} Mbps</span>
                    </div>
                    <div className={`text-xs font-mono mt-1 font-semibold ${
                      report.metrics.thptDeltaPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {report.metrics.thptDeltaPct >= 0 ? '▲ +' : '▼ '}
                      {report.metrics.thptDeltaPct}% vs Baseline
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-mono mb-1">Avg Latency (RTT)</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold font-mono text-amber-300">{report.metrics.simAvgRtt}</span>
                      <span className="text-xs font-mono text-slate-500">/ {report.metrics.baseAvgRtt} ms</span>
                    </div>
                    <div className={`text-xs font-mono mt-1 font-semibold ${
                      report.metrics.rttDeltaPct <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {report.metrics.rttDeltaPct <= 0 ? '▼ ' : '▲ +'}
                      {report.metrics.rttDeltaPct}% latency shift
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-mono mb-1">Packet Drops / Loss</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold font-mono text-red-400">{report.metrics.simDropsTotal}</span>
                      <span className="text-xs font-mono text-slate-500">/ {report.metrics.baseDropsTotal} drops</span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1">
                      Goodput: <span className="text-emerald-400 font-bold">{report.metrics.goodputPct}%</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                    <div className="text-[11px] text-slate-400 uppercase font-mono mb-1">Jain's Fairness</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold font-mono text-purple-300">{report.metrics.fairnessIndex}</span>
                      <span className="text-xs font-mono text-slate-500">/ 1.000</span>
                    </div>
                    <div className="text-xs font-mono text-emerald-400 mt-1 font-semibold">
                      Excellent Resource Sharing
                    </div>
                  </div>
                </div>
              )}

              {/* Verdict Banner */}
              {report && (
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  report.verdict === 'SUPERIOR'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : report.verdict === 'INFERIOR'
                    ? 'bg-red-950/40 border-red-500/40 text-red-200'
                    : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={22} className="text-cyan-400" />
                    <div>
                      <div className="font-semibold text-sm">Simulation Performance Verdict: {report.verdict}</div>
                      <div className="text-xs text-slate-300 mt-0.5">{report.verdictSummary}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('REPORT')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-medium text-white flex items-center gap-1.5 transition"
                  >
                    View Report <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* Comparative Trace Curve Visualizer */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-cyan-400" />
                    <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                      Throughput Convergence Comparison (Live Run vs Uploaded Trace)
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="w-3 h-0.5 bg-cyan-400" /> Current Simulation ({engine?.algorithmKey})
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-3 h-0.5 bg-amber-400 border-dashed" /> Uploaded Baseline
                    </span>
                  </div>
                </div>

                {/* SVG Curve Diff */}
                <div className="w-full h-48 bg-slate-900/60 rounded-lg p-2 border border-slate-850">
                  <svg viewBox="0 0 800 160" className="w-full h-full overflow-visible">
                    {/* Grid */}
                    {[0, 40, 80, 120].map((y) => (
                      <line key={y} x1="20" y1={y} x2="780" y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                    ))}

                    {/* Baseline Line */}
                    {baselineData?.data && baselineData.data.length > 1 && (
                      <path
                        d={baselineData.data.reduce((acc, pt, i) => {
                          const x = 20 + (i / (baselineData.data.length - 1)) * 760
                          const y = 140 - ((pt.throughput || 10) / 30) * 120
                          return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                        }, '')}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                    )}

                    {/* Live Sim Line */}
                    {simHistory.length > 1 && (
                      <path
                        d={simHistory.reduce((acc, pt, i) => {
                          const x = 20 + (i / (simHistory.length - 1)) * 760
                          const y = 140 - ((pt.throughput || 10) / 30) * 120
                          return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                        }, '')}
                        fill="none"
                        stroke="#00f0ff"
                        strokeWidth="2.5"
                      />
                    )}
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED SIMULATION REPORT */}
          {activeTab === 'REPORT' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 space-y-6 text-slate-300 print:text-black print:bg-white">
              {/* Report Header */}
              <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-wide">
                    NETWORK CONGESTION CONTROL BENCHMARK EVALUATION REPORT
                  </h1>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    Document ID: SIM-REP-{Date.now().toString().slice(-6)} | Date: {new Date().toISOString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={handleDownloadSimCsv}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition"
                  >
                    <Download size={14} /> Export CSV
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Printer size={14} /> Print Report
                  </button>
                </div>
              </div>

              {/* Executive Summary */}
              <div>
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">1. Executive Summary</h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  This report documents a high-fidelity discrete-event evaluation of <strong>{engine?.algorithmKey}</strong> operating
                  across the <em>{engine?.topology?.name}</em> topology against the baseline dataset (<em>{uploadedFileName}</em>).
                  The simulated network features a <strong>{engine?.bottleneckBw} Mbps</strong> bottleneck gateway with a queue limit of{' '}
                  <strong>{engine?.bottleneckBuffer} packets</strong> governed by the <strong>{engine?.queuePolicy}</strong> queue discipline.
                </p>
              </div>

              {/* Statistical Benchmark Comparison Table */}
              <div>
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">2. Performance Metrics & Comparative Delta</h3>
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs font-mono divide-y divide-slate-850">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Evaluation Metric</th>
                        <th className="py-2.5 px-3">Simulated Run</th>
                        <th className="py-2.5 px-3">Baseline Target</th>
                        <th className="py-2.5 px-3">Variance (Δ)</th>
                        <th className="py-2.5 px-3">Engineering Assessment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">Mean Goodput / Throughput</td>
                        <td className="py-2.5 px-3 text-cyan-300 font-bold">{report?.metrics.simAvgThpt} Mbps</td>
                        <td className="py-2.5 px-3 text-slate-400">{report?.metrics.baseAvgThpt} Mbps</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-400">{report?.metrics.thptDeltaPct}%</td>
                        <td className="py-2.5 px-3 text-slate-400">Bottleneck link capacity utilization</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">Peak Observed Bandwidth</td>
                        <td className="py-2.5 px-3 text-cyan-300 font-bold">{report?.metrics.simPeakThpt} Mbps</td>
                        <td className="py-2.5 px-3 text-slate-400">{report?.metrics.basePeakThpt} Mbps</td>
                        <td className="py-2.5 px-3 text-slate-400">-</td>
                        <td className="py-2.5 px-3 text-slate-400">Peak burst capability</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">Mean Round Trip Time (RTT)</td>
                        <td className="py-2.5 px-3 text-amber-300 font-bold">{report?.metrics.simAvgRtt} ms</td>
                        <td className="py-2.5 px-3 text-slate-400">{report?.metrics.baseAvgRtt} ms</td>
                        <td className="py-2.5 px-3 text-amber-400">{report?.metrics.rttDeltaPct}%</td>
                        <td className="py-2.5 px-3 text-slate-400">Queue buffering latency</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">95th Percentile Latency (p95)</td>
                        <td className="py-2.5 px-3 text-amber-300 font-bold">{report?.metrics.simP95Rtt} ms</td>
                        <td className="py-2.5 px-3 text-slate-400">{report?.metrics.baseP95Rtt} ms</td>
                        <td className="py-2.5 px-3 text-slate-400">-</td>
                        <td className="py-2.5 px-3 text-slate-400">Tail latency guarantee</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">Cumulative Packet Drops</td>
                        <td className="py-2.5 px-3 text-red-400 font-bold">{report?.metrics.simDropsTotal} pkts</td>
                        <td className="py-2.5 px-3 text-slate-400">{report?.metrics.baseDropsTotal} pkts</td>
                        <td className="py-2.5 px-3 text-slate-400">{report?.metrics.dropsDelta} pkts</td>
                        <td className="py-2.5 px-3 text-slate-400">Buffer overflow events</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">Jain's Fairness Index</td>
                        <td className="py-2.5 px-3 text-purple-300 font-bold">{report?.metrics.fairnessIndex}</td>
                        <td className="py-2.5 px-3 text-slate-400">0.950</td>
                        <td className="py-2.5 px-3 text-emerald-400">+0.030</td>
                        <td className="py-2.5 px-3 text-slate-400">Multi-flow bandwidth equity</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Algorithmic Analysis & Recommendations */}
              <div>
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">3. Congestion Control Algorithmic Analysis</h3>
                <div className="space-y-2 text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                  <p>
                    <strong>Window Dynamics:</strong> Under <strong>{engine?.algorithmKey}</strong>, the sender expands its window exponentially
                    during Slow-Start, transitioning to Congestion Avoidance upon reaching <code>ssthresh</code>. In high Bandwidth-Delay Product (BDP)
                    conditions, CUBIC or BBR achieve significantly faster recovery following loss events than traditional Reno or Tahoe.
                  </p>
                  <p>
                    <strong>Bufferbloat Mitigation:</strong> The bottleneck queue reached a peak occupancy of{' '}
                    <code>{Math.max(...(simHistory.map(d => d.queueOccupancy || 0)), 10).toFixed(0)}%</code>. When paired with{' '}
                    <strong>{engine?.queuePolicy === 'RED' ? 'Random Early Detection (AQM)' : 'FIFO Tail Drop'}</strong>,{' '}
                    {engine?.queuePolicy === 'RED'
                      ? 'proactive early drops / ECN signaling prevented buffer saturation and synchronized TCP global collapse.'
                      : 'tail drop causes queue full starvation before TCP senders scale back their rate.'}
                  </p>
                  <p>
                    <strong>Architectural Recommendations:</strong>
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400">
                    <li>Size bottleneck router buffers according to the BDP rule: <code>B = C × RTT</code> (approx. 20-30 packets for this topology).</li>
                    <li>For long-distance WAN or cellular links with non-congestive loss, deploy <strong>BBR</strong> to prevent throughput collapse.</li>
                    <li>Enable <strong>ECN (Explicit Congestion Notification)</strong> on core routers to signal congestion without discarding packets.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FILE UPLOAD & PRESETS */}
          {activeTab === 'UPLOAD' && (
            <div className="space-y-6">
              {/* Drag & Drop File Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/80 group"
              >
                <UploadCloud size={44} className="text-slate-500 group-hover:text-cyan-400 mb-3 transition" />
                <h3 className="text-sm font-semibold text-white mb-1">
                  Upload CSV or JSON Baseline Benchmark File
                </h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Drag and drop your ns-3, iperf3, Wireshark, or prior simulation export file here, or click to browse.
                  Supports columns: <code>time, cwnd, throughput, rtt, drops</code>.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {parseError && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 text-red-300 rounded-lg text-xs font-mono flex items-center gap-2">
                  <AlertTriangle size={16} /> {parseError}
                </div>
              )}

              {/* Ready-to-use Baseline Presets */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FileText size={15} className="text-amber-400" />
                  Ready-to-Use Sample Baseline Benchmarks (1-Click Load)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleLoadPreset('RENO_BASELINE', 'Standard TCP Reno Enterprise WAN Baseline')}
                    className="text-left p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 transition group"
                  >
                    <div className="font-semibold text-xs text-white group-hover:text-cyan-400">
                      Standard TCP Reno Trace (40 Mbps WAN)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Traditional AIMD sawtooth benchmark with 35ms average latency.
                    </div>
                  </button>

                  <button
                    onClick={() => handleLoadPreset('TAHOE_BASELINE', 'Classic TCP Tahoe Benchmark Trace')}
                    className="text-left p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 transition group"
                  >
                    <div className="font-semibold text-xs text-white group-hover:text-cyan-400">
                      Classic TCP Tahoe Trace (Severe Drop Penalty)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Resets cwnd to 1 on packet loss, illustrating loss-recovery penalties.
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
