import React from 'react'
import { X, Layers } from 'lucide-react'

export default function PduInspectorModal({ packet, onClose, isDark = false }) {
  if (!packet) return null

  const layers = packet.pduLayers || {
    layer1: { inPort: 'FastEthernet0/1', outPort: 'FastEthernet0/1', physicalSpeed: '100 Mbps' },
    layer2: { srcMac: '00:0C:CF:14:01:A2', dstMac: '00:0C:CF:88:B2:D3', frameType: '0x0800 (IPv4)' },
    layer3: { srcIp: packet.srcIp || '192.168.1.10', dstIp: packet.dstIp || '192.168.1.1', ttl: packet.ttl || 64, protocol: packet.protocol || 'TCP (6)' },
    layer4: { srcPort: 49152, dstPort: 80, seq: packet.seq || 1, ack: packet.ack || 0, windowSize: 65535, flags: packet.isAck ? 'ACK' : 'SYN, ACK' },
    payload: `Simulated Packet Payload (${packet.sizeBytes || 1460} bytes)`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className={`rounded-2xl border-2 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col font-sans transition-colors ${
        isDark ? 'bg-slate-900 border-cyan-500/60 text-slate-100' : 'bg-white border-cyan-600 text-slate-800'
      }`}>
        {/* Cisco Packet Tracer Window Header */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 border border-sky-400 flex items-center justify-center text-white text-xs font-bold shadow">
              ✉️
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">
                CISCO PACKET TRACER — PDU INFORMATION
              </h3>
              <p className="text-[11px] font-mono text-cyan-600 font-semibold">
                Packet: <span>{packet.id}</span> | Protocol: <span>{packet.protocol || (packet.isAck ? 'TCP ACK' : 'TCP DATA')}</span>
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

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Envelope Summary Badge */}
          <div className={`border rounded-xl p-3 flex items-center justify-between ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-7 rounded border border-white/40 flex items-center justify-center font-bold text-xs shadow text-white"
                style={{ backgroundColor: packet.flowColor || '#0284c7' }}
              >
                ✉️
              </div>
              <div>
                <div className="text-xs font-bold">
                  {packet.srcIp} <span className="text-slate-400">➔</span> {packet.dstIp}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Size: {packet.sizeBytes || 1460} Bytes | Hop: {packet.hopIndex + 1} of {packet.path?.length || 2}
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-xs">
              <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                packet.isAck
                  ? (isDark ? 'bg-sky-950 border border-sky-400 text-sky-300' : 'bg-sky-100 border border-sky-300 text-sky-800')
                  : (isDark ? 'bg-emerald-950 border border-emerald-400 text-emerald-300' : 'bg-emerald-100 border border-emerald-300 text-emerald-800')
              }`}>
                {packet.isAck ? 'ACK RECEIVED' : 'DATA EN ROUTE'}
              </span>
            </div>
          </div>

          {/* OSI 7-Layer Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
              <Layers size={14} className="text-cyan-600" /> OSI Model In/Out Layer Breakdown
            </h4>

            {/* Layer 7: Application */}
            <div className={`border rounded-lg p-3 flex items-start gap-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-16 text-center shrink-0">
                <span className="block text-[10px] font-bold font-mono text-purple-700 bg-purple-100 border border-purple-300 rounded py-0.5">
                  Layer 7
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5 font-semibold">Application</span>
              </div>
              <div className="text-xs font-mono flex-1">
                <div className="font-semibold text-slate-800">Payload: {layers.payload}</div>
                <div className="text-slate-400 text-[11px]">Simulated Network Traffic PDU</div>
              </div>
            </div>

            {/* Layer 4: Transport */}
            <div className={`border rounded-lg p-3 flex items-start gap-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-16 text-center shrink-0">
                <span className="block text-[10px] font-bold font-mono text-emerald-700 bg-emerald-100 border border-emerald-300 rounded py-0.5">
                  Layer 4
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5 font-semibold">Transport</span>
              </div>
              <div className="text-xs font-mono flex-1 grid grid-cols-2 gap-1.5">
                <div>Source Port: <span className="font-bold text-slate-900">{layers.layer4?.srcPort || 49152}</span></div>
                <div>Dest Port: <span className="font-bold text-slate-900">{layers.layer4?.dstPort || 80}</span></div>
                <div>Sequence #: <span className="font-bold text-cyan-700">#{layers.layer4?.seq || packet.seq}</span></div>
                <div>Ack #: <span className="font-bold text-sky-700">#{layers.layer4?.ack || packet.ack}</span></div>
                <div>Flags: <span className="font-bold text-amber-700">{layers.layer4?.flags || (packet.isAck ? 'ACK' : 'SYN')}</span></div>
                <div>Window Size: <span className="font-bold text-emerald-700">{layers.layer4?.windowSize || 65535} bytes</span></div>
              </div>
            </div>

            {/* Layer 3: Network */}
            <div className={`border rounded-lg p-3 flex items-start gap-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-16 text-center shrink-0">
                <span className="block text-[10px] font-bold font-mono text-cyan-700 bg-cyan-100 border border-cyan-300 rounded py-0.5">
                  Layer 3
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5 font-semibold">Network</span>
              </div>
              <div className="text-xs font-mono flex-1 grid grid-cols-2 gap-1.5">
                <div>Source IP: <span className="font-bold text-cyan-800">{layers.layer3?.srcIp || packet.srcIp}</span></div>
                <div>Dest IP: <span className="font-bold text-cyan-800">{layers.layer3?.dstIp || packet.dstIp}</span></div>
                <div>TTL: <span className="font-bold text-slate-900">{layers.layer3?.ttl || 64}</span></div>
                <div>Protocol: <span className="font-bold text-emerald-700">{layers.layer3?.protocol || 'TCP (6)'}</span></div>
              </div>
            </div>

            {/* Layer 2: Data Link */}
            <div className={`border rounded-lg p-3 flex items-start gap-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-16 text-center shrink-0">
                <span className="block text-[10px] font-bold font-mono text-amber-700 bg-amber-100 border border-amber-300 rounded py-0.5">
                  Layer 2
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5 font-semibold">Data Link</span>
              </div>
              <div className="text-xs font-mono flex-1 grid grid-cols-2 gap-1.5">
                <div>Source MAC: <span className="text-slate-700">{layers.layer2?.srcMac || '00:0C:CF:14:01:A2'}</span></div>
                <div>Dest MAC: <span className="text-slate-700">{layers.layer2?.dstMac || '00:0C:CF:88:B2:D3'}</span></div>
                <div className="col-span-2 text-slate-500">Frame Type: <span className="font-bold text-amber-800">{layers.layer2?.frameType || '0x0800 (Ethernet II)'}</span></div>
              </div>
            </div>

            {/* Layer 1: Physical */}
            <div className={`border rounded-lg p-3 flex items-start gap-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-16 text-center shrink-0">
                <span className="block text-[10px] font-bold font-mono text-slate-700 bg-slate-200 rounded py-0.5">
                  Layer 1
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5 font-semibold">Physical</span>
              </div>
              <div className="text-xs font-mono flex-1">
                <div>Port: <span className="font-bold text-cyan-800">{layers.layer1?.outPort || 'FastEthernet0/1'}</span> ({layers.layer1?.physicalSpeed || '100 Mbps'})</div>
                <div className="text-slate-400 text-[11px]">Transmitting frame bits over physical medium</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t flex justify-end ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs transition shadow"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  )
}
