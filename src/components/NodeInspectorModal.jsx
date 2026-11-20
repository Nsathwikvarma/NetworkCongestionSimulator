import React, { useState } from 'react'
import { X, Network, Server, ArrowDownRight, ArrowUpRight, ShieldAlert, Cpu, Send, Layers } from 'lucide-react'

export default function NodeInspectorModal({ node, engine, onClose, isDark = false }) {
  const [customSrcIp, setCustomSrcIp] = useState(node?.ip || '10.10.1.101')
  const [customDstIp, setCustomDstIp] = useState('198.51.100.10')
  const [injectCount, setInjectCount] = useState(10)
  const [injectStatus, setInjectStatus] = useState('')

  if (!node || !engine) return null

  const stats = engine.nodeIpStats ? engine.nodeIpStats.get(node.id) : null
  const queue = engine.routerQueues ? engine.routerQueues.get(node.id) : null

  const handleInjectCustomBurst = (e) => {
    e.preventDefault()
    if (!engine) return

    for (let k = 0; k < injectCount; k++) {
      const serverNodes = engine.topology.nodes.filter(n => n.type === 'server')
      const targetServer = serverNodes[0] || node
      const path = engine.findPath(node.id, targetServer.id) || [node.id]

      const burstPkt = {
        id: `inject_${Date.now()}_${k}`,
        flowId: node.id,
        flowColor: '#e11d48',
        srcNode: node.id,
        dstNode: targetServer.id,
        srcIp: customSrcIp,
        dstIp: customDstIp,
        sizeBytes: 1460,
        seq: k + 1,
        ack: 0,
        isAck: false,
        ttl: 64,
        ecnCapable: true,
        path: path,
        hopIndex: 0,
        progress: 0.05 * (k % 4),
        linkTransitTimeMs: 14,
        sendTimestamp: engine.simTimeMs
      }
      engine.packets.push(burstPkt)
    }

    setInjectStatus(`Injected ${injectCount} custom packets from ${customSrcIp}!`)
    setTimeout(() => setInjectStatus(''), 3000)
  }

  const ipList = stats && stats.ipCounters ? Object.entries(stats.ipCounters) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className={`rounded-2xl border w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors ${
        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              node.type === 'router'
                ? (isDark ? 'bg-amber-950/40 border-amber-500/40 text-amber-400' : 'bg-sky-50 border-sky-300 text-sky-700')
                : (isDark ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700')
            }`}>
              {node.type === 'router' ? <Network size={22} /> : <Server size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-wide">{node.name}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                }`}>
                  {node.type}
                </span>
                {node.isBottleneck && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-400">
                    BOTTLENECK NODE
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-cyan-600 mt-0.5 font-semibold">
                Node IP: <span className="font-bold">{node.ip}</span> | Subnet: <span>{node.subnet || 'N/A'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`border p-3 rounded-xl ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 font-semibold">
                <ArrowDownRight size={14} className="text-emerald-600" /> Ingress Packets
              </div>
              <div className="text-lg font-mono font-bold">{stats?.totalInPkts || 0}</div>
              <div className="text-[10px] text-slate-400 font-mono">{((stats?.totalInBytes || 0) / 1024).toFixed(1)} KB</div>
            </div>

            <div className={`border p-3 rounded-xl ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 font-semibold">
                <ArrowUpRight size={14} className="text-cyan-600" /> Egress Packets
              </div>
              <div className="text-lg font-mono font-bold">{stats?.totalOutPkts || 0}</div>
              <div className="text-[10px] text-slate-400 font-mono">{((stats?.totalOutBytes || 0) / 1024).toFixed(1)} KB</div>
            </div>

            <div className={`border p-3 rounded-xl ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 font-semibold">
                <ShieldAlert size={14} className="text-red-500" /> Dropped Packets
              </div>
              <div className="text-lg font-mono font-bold text-red-600">{stats?.totalDrops || 0}</div>
              <div className="text-[10px] text-slate-400 font-mono">Buffer / AQM events</div>
            </div>

            <div className={`border p-3 rounded-xl ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 font-semibold">
                <Layers size={14} className="text-amber-500" /> Active Buffer
              </div>
              <div className="text-lg font-mono font-bold text-amber-600">
                {queue ? `${queue.packets.length}/${queue.capacity}` : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {queue ? `Policy: ${queue.policy}` : 'Pass-through'}
              </div>
            </div>
          </div>

          {/* Buffer Queue Slot Visualizer (for routers/switches) */}
          {queue && (
            <div className={`border p-4 rounded-xl ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-amber-600" />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Live Hardware Buffer Slots ({queue.packets.length} / {queue.capacity})
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {queue.policy === 'RED' ? 'AQM: Random Early Detection' : 'FIFO Tail Drop Discipline'}
                </span>
              </div>

              {/* Individual Packet Queue Slots */}
              <div className={`grid grid-cols-12 sm:grid-cols-16 gap-1.5 p-3 rounded-lg border ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                {Array.from({ length: queue.capacity }).map((_, idx) => {
                  const queuedPkt = queue.packets[idx]
                  return (
                    <div
                      key={idx}
                      className={`h-7 rounded flex items-center justify-center font-mono text-[9px] border transition-all ${
                        queuedPkt
                          ? 'bg-cyan-100 border-cyan-400 text-cyan-800 font-bold shadow-sm'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                      title={queuedPkt ? `Packet: ${queuedPkt.id} | Src: ${queuedPkt.srcIp} | Seq: ${queuedPkt.seq}` : 'Empty Buffer Slot'}
                    >
                      {queuedPkt ? queuedPkt.seq : idx + 1}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Variable IP Forwarding Table */}
          <div className={`border p-4 rounded-xl ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                Variable IP Output & Forwarding Matrix
              </h3>
              <span className="text-[11px] font-mono text-slate-500 font-semibold">Tracked Distinct IPs: {ipList.length}</span>
            </div>

            {ipList.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-mono">
                No IP packets have traversed this interface yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className={`border-b text-[11px] ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <th className="pb-2">Source IP</th>
                      <th className="pb-2">Direction</th>
                      <th className="pb-2">Packets In</th>
                      <th className="pb-2">Packets Out</th>
                      <th className="pb-2">Total Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ipList.map(([ip, data]) => (
                      <tr key={ip} className="hover:bg-slate-100/60">
                        <td className="py-2 text-cyan-700 font-bold">{ip}</td>
                        <td className="py-2 text-slate-600">Bidirectional</td>
                        <td className="py-2 text-slate-600">{data.inPkts}</td>
                        <td className="py-2 text-slate-600">{data.outPkts}</td>
                        <td className="py-2 font-bold text-slate-800">
                          {((data.inBytes + data.outBytes) / 1024).toFixed(1)} KB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-3.5 border-t flex justify-end ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  )
}
