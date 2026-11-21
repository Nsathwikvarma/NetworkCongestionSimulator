import React, { useState } from 'react'
import {
  X, AlertTriangle, Trash2, Filter, ShieldAlert,
  Flame, RefreshCw, Eye, ArrowRight, Layers
} from 'lucide-react'

export default function LostPacketsModal({
  isOpen,
  onClose,
  lostPackets = [],
  onClear = () => {},
  onForceDrop = () => {},
  onForceBurst = () => {},
  onInspectPacket = () => {},
  isDark = false
}) {
  const [filterReason, setFilterReason] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  if (!isOpen) return null

  const REASONS = [
    { id: 'ALL', label: 'All Losses' },
    { id: 'BUFFER_OVERFLOW', label: 'Buffer Overflow' },
    { id: 'MANUAL_FORCED_DROP', label: 'Manual Drops' },
    { id: 'RANDOM_CHANNEL_LOSS', label: 'Channel Loss' },
    { id: 'TTL_EXPIRED', label: 'TTL Expired' },
    { id: 'RED_EARLY_DROP', label: 'RED Early Drop' }
  ]

  const filtered = lostPackets.filter(pkt => {
    const matchFilter = filterReason === 'ALL' || pkt.reason === filterReason
    const matchSearch = searchTerm === '' ||
      pkt.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkt.srcNodeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkt.dstNodeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkt.dropNodeName?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchFilter && matchSearch
  })

  const getReasonBadge = (reason) => {
    switch (reason) {
      case 'BUFFER_OVERFLOW':
      case 'TAIL_DROP':
        return {
          bg: isDark ? 'bg-red-950/80 border-red-500/50 text-red-300' : 'bg-red-100 border-red-300 text-red-800',
          label: 'Queue Overflow (Tail Drop)'
        }
      case 'MANUAL_FORCED_DROP':
        return {
          bg: isDark ? 'bg-amber-950/80 border-amber-500/50 text-amber-300' : 'bg-amber-100 border-amber-300 text-amber-800',
          label: 'Manual Forced Drop 💥'
        }
      case 'RANDOM_CHANNEL_LOSS':
        return {
          bg: isDark ? 'bg-orange-950/80 border-orange-500/50 text-orange-300' : 'bg-orange-100 border-orange-300 text-orange-800',
          label: 'Random Channel Loss'
        }
      case 'RED_EARLY_DROP':
        return {
          bg: isDark ? 'bg-purple-950/80 border-purple-500/50 text-purple-300' : 'bg-purple-100 border-purple-300 text-purple-800',
          label: 'RED Early Drop'
        }
      case 'TTL_EXPIRED':
        return {
          bg: isDark ? 'bg-yellow-950/80 border-yellow-500/50 text-yellow-300' : 'bg-yellow-100 border-yellow-300 text-yellow-800',
          label: 'TTL Expired (Hop Limit)'
        }
      default:
        return {
          bg: isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700',
          label: reason || 'Packet Dropped'
        }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className={`w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl border overflow-hidden font-sans ${
        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 border border-red-400 flex items-center justify-center text-white shadow">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">LOST PACKETS CEMETERY & LEDGER</h2>
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white font-mono font-bold text-xs">
                  {lostPackets.length} Dropped
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Real-time forensic record of packets dropped due to congestion, queue overflow, or intentional loss
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Controls & Loss Generator Toolbar */}
        <div className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0 ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
        }`}>
          {/* Quick Loss Generators */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500">Generate Loss:</span>
            <button
              onClick={onForceDrop}
              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
              title="Force drop the next packet currently in flight or synthesize an immediate loss"
            >
              <Flame size={14} />
              <span>Drop Next Packet</span>
            </button>
            <button
              onClick={() => onForceBurst(5)}
              className="px-2.5 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
              title="Induce burst congestion loss by dropping 5 packets in a row"
            >
              <AlertTriangle size={14} />
              <span>Drop Burst (5 Pkts)</span>
            </button>
          </div>

          {/* Search & Clear */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by device or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono focus:outline-none w-44 ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
              }`}
            />
            {lostPackets.length > 0 && (
              <button
                onClick={onClear}
                className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-red-50 hover:text-red-700 text-slate-600 transition flex items-center gap-1"
                title="Clear all lost packets from this ledger"
              >
                <Trash2 size={13} />
                <span>Clear Ledger</span>
              </button>
            )}
          </div>
        </div>

        {/* Reason Filter Tabs */}
        <div className={`px-4 py-2 border-b flex items-center gap-1.5 text-xs font-mono overflow-x-auto shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
        }`}>
          <Filter size={13} className="text-slate-400 mr-1 shrink-0" />
          {REASONS.map(r => (
            <button
              key={r.id}
              onClick={() => setFilterReason(r.id)}
              className={`px-2 py-0.5 rounded-md transition whitespace-nowrap text-[11px] ${
                filterReason === r.id
                  ? (isDark ? 'bg-red-600 text-white font-bold' : 'bg-red-600 text-white font-bold')
                  : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:bg-slate-100')
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Lost Packets Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400 font-mono">
              <ShieldAlert size={40} className="text-slate-300 mb-2" />
              <div className="font-bold text-sm text-slate-600">
                {lostPackets.length === 0 ? 'No packets lost yet!' : 'No matching lost packets for this filter'}
              </div>
              <p className="text-xs max-w-md mt-1 text-slate-400">
                {lostPackets.length === 0
                  ? 'All packets are arriving safely. Click "Drop Next Packet" above or inject a traffic spike to observe congestion drop behavior!'
                  : 'Try selecting "All Losses" or clearing the search box.'}
              </p>
              {lostPackets.length === 0 && (
                <button
                  onClick={onForceDrop}
                  className="mt-4 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow"
                >
                  <Flame size={14} />
                  <span>Generate Test Loss Now</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 font-mono text-xs">
              {filtered.map((pkt, idx) => {
                const badge = getReasonBadge(pkt.reason)
                return (
                  <div
                    key={pkt.id || idx}
                    className={`py-3 px-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition ${
                      isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Left: Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-red-100 border border-red-300 flex items-center justify-center text-red-600 font-bold shrink-0 mt-0.5">
                        💥
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-slate-800 dark:text-slate-100 text-xs">{pkt.id}</strong>
                          <span className="text-[10px] text-slate-400">{pkt.wallTime || `${pkt.timeSec}s`}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 truncate">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {pkt.srcNodeName || pkt.srcNode} ({pkt.srcIp || 'IP'})
                          </span>
                          <ArrowRight size={12} className="text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {pkt.dstNodeName || pkt.dstNode} ({pkt.dstIp || 'IP'})
                          </span>
                          <span className="text-slate-400">|</span>
                          <span>Dropped at: <strong className="text-red-600">{pkt.dropNodeName || pkt.dropNodeId}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <div className="text-[11px] text-right font-mono text-slate-400 hidden md:block">
                        <div>Seq #{pkt.seq} • {pkt.sizeBytes} B</div>
                        <div>Protocol: {pkt.protocol || 'TCP'}</div>
                      </div>
                      {pkt.pduLayers && (
                        <button
                          onClick={() => onInspectPacket(pkt)}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 transition"
                          title="Inspect OSI 7-Layer headers of this lost packet"
                        >
                          <Layers size={13} />
                          <span>Inspect</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer summary */}
        <div className={`p-3 border-t text-[11px] font-mono flex items-center justify-between shrink-0 ${
          isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div>
            Showing <strong>{filtered.length}</strong> of <strong>{lostPackets.length}</strong> lost packet events
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tip: TCP Reno/Cubic will halve cwnd upon packet loss</span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 font-bold text-slate-800 dark:text-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
