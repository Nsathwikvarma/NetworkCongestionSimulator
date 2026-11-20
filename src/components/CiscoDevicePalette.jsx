import React, { useState } from 'react'
import {
  Monitor, Server, Cpu, Cable, Trash2, MousePointer
} from 'lucide-react'

export default function CiscoDevicePalette({
  activeTool,
  setActiveTool,
  onAddDevice,
  onOpenCustomPdu,
  cableSourceNode,
  pduSourceNode,
  isDark = false
}) {
  const [selectedCategory, setSelectedCategory] = useState('NETWORK_DEVICES')

  return (
    <div className={`h-28 border-t-2 flex flex-col font-sans select-none shrink-0 z-20 transition-colors duration-200 ${
      isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
    }`}>
      {/* Top Shelf Bar: Active Tool Status + Mode Buttons */}
      <div className={`h-8 border-b px-3 flex items-center justify-between text-xs font-mono ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300'
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
            Cisco Tools:
          </span>

          {/* Select / Move Tool */}
          <button
            onClick={() => setActiveTool('SELECT')}
            className={`px-2.5 py-0.5 rounded text-xs flex items-center gap-1.5 transition ${
              activeTool === 'SELECT'
                ? 'bg-cyan-600 text-white font-bold shadow'
                : (isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300')
            }`}
            title="Select & Move Devices (Drag any PC, Router, or Switch)"
          >
            <MousePointer size={13} />
            <span>Select (Move)</span>
          </button>

          {/* Connect Cable Tool */}
          <button
            onClick={() => setActiveTool('CONNECT')}
            className={`px-2.5 py-0.5 rounded text-xs flex items-center gap-1.5 transition ${
              activeTool === 'CONNECT'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : (isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300')
            }`}
            title="Connect Cable: Click Device 1, then click Device 2 to wire them together"
          >
            <Cable size={13} />
            <span>Connect Cable</span>
          </button>

          {/* Delete Tool */}
          <button
            onClick={() => setActiveTool('DELETE')}
            className={`px-2.5 py-0.5 rounded text-xs flex items-center gap-1.5 transition ${
              activeTool === 'DELETE'
                ? 'bg-rose-600 text-white font-bold shadow'
                : (isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300')
            }`}
            title="Delete: Click any device or cable to delete it"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>

          {/* Add Simple PDU Envelope Tool */}
          <button
            onClick={() => setActiveTool('SIMPLE_PDU')}
            className={`px-2.5 py-0.5 rounded text-xs flex items-center gap-1.5 transition ${
              activeTool === 'SIMPLE_PDU'
                ? 'bg-emerald-600 text-white font-bold shadow'
                : (isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300')
            }`}
            title="Add Simple PDU: Click Source device, then click Destination device to fire an envelope"
          >
            <span>✉️</span>
            <span>Simple PDU</span>
          </button>

          {/* Custom PDU Button */}
          <button
            onClick={onOpenCustomPdu}
            className={`px-2.5 py-0.5 rounded font-semibold text-xs flex items-center gap-1.5 transition border ${
              isDark
                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-emerald-50 border-emerald-400 text-emerald-800 hover:bg-emerald-100 font-bold'
            }`}
            title="Open Packet Crafter & PDU Generator"
          >
            <span>✉️⚙️</span>
            <span>Customize Packet</span>
          </button>
        </div>

        {/* Dynamic Tool Guide Prompt */}
        <div className="text-[11px] flex items-center gap-2 font-bold">
          {activeTool === 'CONNECT' && (
            <span className="text-amber-600">
              ⚡ {cableSourceNode ? `Click target device to wire to ${cableSourceNode.name}` : 'Click first device to start cable connection...'}
            </span>
          )}
          {activeTool === 'SIMPLE_PDU' && (
            <span className="text-emerald-600">
              ✉️ {pduSourceNode ? `Click target device to fire envelope from ${pduSourceNode.name}` : 'Click source device to fire packet...'}
            </span>
          )}
          {activeTool === 'DELETE' && (
            <span className="text-rose-600">
              ✕ Click any device or cable to delete it from workspace
            </span>
          )}
          {activeTool === 'SELECT' && (
            <span className="text-slate-500">
              🖱️ Drag devices to rearrange • Click to inspect properties
            </span>
          )}
        </div>
      </div>

      {/* Bottom Device Rack (Cisco Packet Tracer Shelf) */}
      <div className="flex-1 flex items-stretch">
        {/* Category Selector on Left */}
        <div className={`w-44 border-r p-1 flex flex-col justify-center gap-1 shrink-0 text-xs font-mono ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
        }`}>
          <button
            onClick={() => setSelectedCategory('NETWORK_DEVICES')}
            className={`px-2 py-1 rounded flex items-center gap-2 text-left transition ${
              selectedCategory === 'NETWORK_DEVICES'
                ? (isDark ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold' : 'bg-white border border-slate-300 text-cyan-700 font-bold shadow-sm')
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Cpu size={14} className="text-cyan-600" />
            <span>Network Devices</span>
          </button>

          <button
            onClick={() => setSelectedCategory('END_DEVICES')}
            className={`px-2 py-1 rounded flex items-center gap-2 text-left transition ${
              selectedCategory === 'END_DEVICES'
                ? (isDark ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold' : 'bg-white border border-slate-300 text-cyan-700 font-bold shadow-sm')
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Monitor size={14} className="text-emerald-600" />
            <span>End Devices (PCs)</span>
          </button>

          <button
            onClick={() => setSelectedCategory('CONNECTIONS')}
            className={`px-2 py-1 rounded flex items-center gap-2 text-left transition ${
              selectedCategory === 'CONNECTIONS'
                ? (isDark ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold' : 'bg-white border border-slate-300 text-cyan-700 font-bold shadow-sm')
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Cable size={14} className="text-amber-600" />
            <span>Connections</span>
          </button>
        </div>

        {/* Sub-Device Items in Selected Category */}
        <div className={`flex-1 p-2 flex items-center gap-4 overflow-x-auto ${
          isDark ? 'bg-slate-900/60' : 'bg-white'
        }`}>
          {selectedCategory === 'NETWORK_DEVICES' && (
            <>
              {/* Cisco 2911 Router */}
              <button
                onClick={() => onAddDevice('router')}
                className={`group flex flex-col items-center justify-center p-2 rounded-lg border transition min-w-[110px] ${
                  isDark ? 'bg-slate-950 border-slate-800 hover:border-cyan-500' : 'bg-slate-50 border-slate-300 hover:border-cyan-500 hover:bg-cyan-50/50 shadow-sm'
                }`}
                title="Click to add Cisco 2911 Router to workspace"
              >
                <div className="w-10 h-7 rounded-full bg-sky-600 border border-sky-400 flex items-center justify-center text-white text-[11px] font-bold shadow group-hover:scale-105 transition">
                  ⇄ ⇅
                </div>
                <span className="text-xs font-bold text-slate-800 mt-1 font-mono">Cisco 2911</span>
                <span className="text-[10px] text-cyan-600 font-mono font-bold">+ Add Router</span>
              </button>

              {/* Cisco 2960 Switch */}
              <button
                onClick={() => onAddDevice('switch')}
                className={`group flex flex-col items-center justify-center p-2 rounded-lg border transition min-w-[110px] ${
                  isDark ? 'bg-slate-950 border-slate-800 hover:border-cyan-500' : 'bg-slate-50 border-slate-300 hover:border-cyan-500 hover:bg-cyan-50/50 shadow-sm'
                }`}
                title="Click to add Cisco 2960 Switch to workspace"
              >
                <div className="w-10 h-6 rounded bg-slate-700 border border-slate-500 flex items-center justify-center text-cyan-300 text-[11px] font-bold shadow group-hover:scale-105 transition">
                  ⇆
                </div>
                <span className="text-xs font-bold text-slate-800 mt-1 font-mono">Cisco 2960</span>
                <span className="text-[10px] text-cyan-600 font-mono font-bold">+ Add Switch</span>
              </button>

              {/* Bottleneck WAN Gateway */}
              <button
                onClick={() => onAddDevice('bottleneck_router')}
                className={`group flex flex-col items-center justify-center p-2 rounded-lg border transition min-w-[125px] ${
                  isDark ? 'bg-slate-950 border-amber-800 hover:border-amber-500' : 'bg-amber-50/60 border-amber-300 hover:border-amber-500 shadow-sm'
                }`}
                title="Add WAN Bottleneck Router with constrained buffer capacity"
              >
                <div className="w-10 h-7 rounded-full bg-amber-600 border border-amber-400 flex items-center justify-center text-white text-[11px] font-bold shadow group-hover:scale-105 transition">
                  ⚠️
                </div>
                <span className="text-xs font-bold text-amber-900 mt-1 font-mono">WAN Bottleneck</span>
                <span className="text-[10px] text-amber-700 font-mono font-bold">+ Add WAN Edge</span>
              </button>
            </>
          )}

          {selectedCategory === 'END_DEVICES' && (
            <>
              {/* PC Workstation */}
              <button
                onClick={() => onAddDevice('host')}
                className={`group flex flex-col items-center justify-center p-2 rounded-lg border transition min-w-[110px] ${
                  isDark ? 'bg-slate-950 border-slate-800 hover:border-emerald-500' : 'bg-slate-50 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 shadow-sm'
                }`}
                title="Click to add PC Workstation to workspace"
              >
                <div className="w-9 h-7 rounded bg-slate-200 border border-emerald-500 flex items-center justify-center text-emerald-600 shadow group-hover:scale-105 transition">
                  <Monitor size={16} />
                </div>
                <span className="text-xs font-bold text-slate-800 mt-1 font-mono">PC-PT</span>
                <span className="text-[10px] text-emerald-600 font-mono font-bold">+ Add PC Host</span>
              </button>

              {/* Server */}
              <button
                onClick={() => onAddDevice('server')}
                className={`group flex flex-col items-center justify-center p-2 rounded-lg border transition min-w-[110px] ${
                  isDark ? 'bg-slate-950 border-slate-800 hover:border-purple-500' : 'bg-slate-50 border-slate-300 hover:border-purple-500 hover:bg-purple-50/50 shadow-sm'
                }`}
                title="Click to add Cloud/Local Server to workspace"
              >
                <div className="w-9 h-7 rounded bg-slate-200 border border-purple-500 flex items-center justify-center text-purple-600 shadow group-hover:scale-105 transition">
                  <Server size={16} />
                </div>
                <span className="text-xs font-bold text-slate-800 mt-1 font-mono">Server-PT</span>
                <span className="text-[10px] text-purple-600 font-mono font-bold">+ Add Server</span>
              </button>
            </>
          )}

          {selectedCategory === 'CONNECTIONS' && (
            <>
              {/* Copper Straight-Through Cable */}
              <button
                onClick={() => setActiveTool('CONNECT')}
                className={`group flex flex-col items-center justify-center p-2 rounded-lg border transition min-w-[140px] ${
                  activeTool === 'CONNECT'
                    ? (isDark ? 'border-amber-500 bg-amber-950/20' : 'border-amber-500 bg-amber-50')
                    : (isDark ? 'border-slate-800 hover:border-amber-500' : 'border-slate-300 bg-slate-50 hover:border-amber-500 shadow-sm')
                }`}
                title="Copper Straight-Through Ethernet Cable (Click two devices to wire)"
              >
                <div className="w-12 h-3 bg-cyan-600 rounded-full shadow flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                </div>
                <span className="text-xs font-bold text-slate-800 mt-1 font-mono">Ethernet Cable</span>
                <span className="text-[10px] text-cyan-600 font-mono font-bold">100 Mbps LAN Link</span>
              </button>

              {/* Serial WAN Link */}
              <button
                onClick={() => setActiveTool('CONNECT')}
                className={`group flex flex-col items-center justify-center p-2 rounded-lg border transition min-w-[140px] ${
                  isDark ? 'bg-slate-950 border-slate-800 hover:border-red-500' : 'bg-slate-50 border-slate-300 hover:border-red-500 shadow-sm'
                }`}
                title="Serial DCE/DTE WAN Cable"
              >
                <div className="w-12 h-1.5 bg-red-600 border-dashed border-t border-b border-white" />
                <span className="text-xs font-bold text-slate-800 mt-1 font-mono">Serial WAN Link</span>
                <span className="text-[10px] text-red-600 font-mono font-bold">Bottleneck Cable</span>
              </button>
            </>
          )}

          {/* Quick Notice */}
          <div className="ml-auto text-right text-[11px] font-mono text-slate-500 pr-2 hidden md:block">
            <span>Cisco Packet Tracer Light Workspace</span>
            <div className="text-slate-400">Click any device to spawn onto canvas</div>
          </div>
        </div>
      </div>
    </div>
  )
}
