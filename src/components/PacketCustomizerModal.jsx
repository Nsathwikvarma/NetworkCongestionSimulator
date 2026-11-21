import React, { useState } from 'react'
import { X, Send, Check } from 'lucide-react'

export default function PacketCustomizerModal({ engine, isOpen, onClose, isDark = false }) {
  const nodes = engine?.topology?.nodes || []
  const hostNodes = nodes.filter(n => n.type === 'host' || n.type === 'server')
  const defaultSrc = hostNodes[0]?.id || nodes[0]?.id || ''
  const defaultDst = hostNodes[1]?.id || nodes[1]?.id || ''

  const [srcNodeId, setSrcNodeId] = useState(defaultSrc)
  const [dstNodeId, setDstNodeId] = useState(defaultDst)
  const [protocol, setProtocol] = useState('TCP')
  const [sizeBytes, setSizeBytes] = useState(1460)
  const [packetCount, setPacketCount] = useState(1)
  const [flowColor, setFlowColor] = useState('#059669')
  const [forceDrop, setForceDrop] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('success') // 'success' | 'error'

  const selectedSrcNode = engine?.nodeMap?.get(srcNodeId)
  const selectedDstNode = engine?.nodeMap?.get(dstNodeId)

  const [srcIp, setSrcIp] = useState(selectedSrcNode?.ip || '192.168.1.10')
  const [dstIp, setDstIp] = useState(selectedDstNode?.ip || '192.168.100.10')

  if (!isOpen || !engine) return null

  const handleSrcChange = (id) => {
    setSrcNodeId(id)
    const n = engine.nodeMap.get(id)
    if (n) setSrcIp(n.ip)
  }

  const handleDstChange = (id) => {
    setDstNodeId(id)
    const n = engine.nodeMap.get(id)
    if (n) setDstIp(n.ip)
  }

  const handleSendPdu = (e) => {
    e.preventDefault()
    if (!srcNodeId || !dstNodeId) {
      setStatusType('error')
      setStatusMessage('Please select both a source and destination device.')
      return
    }

    if (srcNodeId === dstNodeId) {
      setStatusType('error')
      setStatusMessage('Source and destination device cannot be the same.')
      return
    }

    const res = engine.injectCustomPacket({
      srcNodeId,
      dstNodeId,
      protocol,
      sizeBytes: Number(sizeBytes),
      count: Number(packetCount),
      flowColor: forceDrop ? '#ef4444' : flowColor,
      srcIp,
      dstIp,
      forceDrop
    })

    if (res.success) {
      setStatusType('success')
      setStatusMessage(
        forceDrop
          ? `Dispatched ${packetCount} envelope(s) flagged for INTENTIONAL DROP! Watch for explosion burst.`
          : `Dispatched ${packetCount} ${protocol} envelope(s) from ${selectedSrcNode?.name} to ${selectedDstNode?.name}!`
      )
      setTimeout(() => {
        setStatusMessage('')
        onClose()
      }, 1500)
    } else {
      setStatusType('error')
      setStatusMessage(res.error || 'Failed to dispatch packet. Ensure devices are connected by a link.')
    }
  }

  const COLOR_OPTIONS = [
    { name: 'Emerald Green', hex: '#059669' },
    { name: 'Sky Blue', hex: '#0284c7' },
    { name: 'Amber Gold', hex: '#d97706' },
    { name: 'Rose Red', hex: '#e11d48' },
    { name: 'Purple Violet', hex: '#7c3aed' },
    { name: 'Cyan Azure', hex: '#0891b2' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className={`rounded-2xl border-2 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col font-sans transition-colors ${
        isDark ? 'bg-slate-900 border-emerald-500/60 text-slate-100' : 'bg-white border-emerald-600 text-slate-800'
      }`}>
        {/* Header */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 border border-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow">
              ✉️
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">
                CISCO PACKET TRACER — PDU CRAFTER & GENERATOR
              </h3>
              <p className="text-[11px] font-mono text-slate-500">
                Customize and inject synthetic packet envelopes across the topology
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSendPdu} className="p-5 space-y-4 text-xs font-mono">
          {/* Status Message */}
          {statusMessage && (
            <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 font-bold ${
              statusType === 'success'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-red-50 border-red-400 text-red-800'
            }`}>
              {statusType === 'success' ? <Check size={14} /> : <X size={14} />}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Source and Destination Pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-bold text-slate-700">1. Source Device (Sender)</label>
              <select
                value={srcNodeId}
                onChange={(e) => handleSrcChange(e.target.value)}
                className={`w-full rounded p-2 text-xs border focus:outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.type})
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-slate-500">
                IP: <input
                  type="text"
                  value={srcIp}
                  onChange={(e) => setSrcIp(e.target.value)}
                  className="bg-transparent border-b border-slate-300 text-emerald-600 font-bold w-28 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">2. Destination Device</label>
              <select
                value={dstNodeId}
                onChange={(e) => handleDstChange(e.target.value)}
                className={`w-full rounded p-2 text-xs border focus:outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.type})
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-slate-500">
                IP: <input
                  type="text"
                  value={dstIp}
                  onChange={(e) => setDstIp(e.target.value)}
                  className="bg-transparent border-b border-slate-300 text-sky-600 font-bold w-28 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Protocol Selection */}
          <div>
            <label className="block mb-1 font-bold text-slate-700">3. Protocol / Algorithm</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'TCP', label: 'TCP Standard' },
                { id: 'CUBIC', label: 'TCP CUBIC' },
                { id: 'BBR', label: 'Google BBR' },
                { id: 'TAHOE', label: 'TCP Tahoe' },
                { id: 'ICMP', label: 'ICMP Ping' },
                { id: 'UDP', label: 'UDP Stream' }
              ].map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setProtocol(p.id)}
                  className={`py-1.5 px-2 rounded border text-center transition font-bold ${
                    protocol === p.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                      : (isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100')
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Packet Size & Count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-bold text-slate-700">4. Payload Size</label>
              <select
                value={sizeBytes}
                onChange={(e) => setSizeBytes(e.target.value)}
                className={`w-full rounded p-2 text-xs border focus:outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="64">64 Bytes (Ping ICMP)</option>
                <option value="512">512 Bytes (Small Segment)</option>
                <option value="1460">1460 Bytes (Standard MTU)</option>
                <option value="1500">1500 Bytes (Full Frame)</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">5. PDU Burst Count</label>
              <div className="flex items-center gap-1">
                {[1, 5, 10, 20].map(cnt => (
                  <button
                    type="button"
                    key={cnt}
                    onClick={() => setPacketCount(cnt)}
                    className={`flex-1 py-1.5 rounded border text-center font-bold ${
                      packetCount === cnt
                        ? 'bg-sky-600 text-white border-sky-600 shadow'
                        : (isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100')
                    }`}
                  >
                    {cnt === 1 ? '1 PDU' : `${cnt} pkts`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Envelope Color Picker */}
          <div>
            <label className="block mb-1.5 font-bold text-slate-700">6. Envelope Badge Color</label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map(c => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setFlowColor(c.hex)}
                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition ${
                    flowColor === c.hex ? 'scale-110 border-slate-800 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {flowColor === c.hex && <Check size={14} className="text-white font-bold" />}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Intentional Loss / Force Drop Option */}
          <div className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
            forceDrop
              ? (isDark ? 'bg-red-950/60 border-red-500/60 text-red-200' : 'bg-red-50 border-red-300 text-red-900')
              : (isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')
          }`}
          onClick={() => setForceDrop(!forceDrop)}
          >
            <div>
              <div className="font-bold flex items-center gap-1.5 text-xs text-red-600">
                <span>💥 Simulate Packet Loss (Intentional Drop)</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Envelope will drop at intermediate bottleneck router and log to Lost Packets Ledger
              </p>
            </div>
            <input
              type="checkbox"
              checked={forceDrop}
              onChange={(e) => setForceDrop(e.target.checked)}
              className="w-4 h-4 accent-red-600 cursor-pointer"
            />
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-2.5 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition ${
                forceDrop ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <Send size={15} />
              <span>{forceDrop ? '💥 DISPATCH & FORCE DROP PACKET (SIMULATE LOSS)' : 'DISPATCH PDU ENVELOPE INTO NETWORK'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
