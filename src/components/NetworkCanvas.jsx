import React, { useRef, useEffect, useState } from 'react'
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Plus, Minus
} from 'lucide-react'

export default function NetworkCanvas({
  engine,
  activeTool = 'SELECT',
  cableSourceNode = null,
  setCableSourceNode = () => {},
  pduSourceNode = null,
  setPduSourceNode = () => {},
  onSelectNode = () => {},
  onInspectPacket = () => {},
  isDark = false
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // Pan & Zoom Camera State
  const [camera, setCamera] = useState({ x: 50, y: 40, scale: 0.95 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [draggedNodeId, setDraggedNodeId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const [hoveredNode, setHoveredNode] = useState(null)
  const [hoveredPacket, setHoveredPacket] = useState(null)
  const [hoveredLink, setHoveredLink] = useState(null)
  const [mouseWorldPos, setMouseWorldPos] = useState({ x: 0, y: 0 })
  const [canvasToast, setCanvasToast] = useState(null)

  const showToast = (message, type = 'info') => {
    setCanvasToast({ message, type })
    setTimeout(() => {
      setCanvasToast(null)
    }, 4000)
  }

  // Handle Resize & Canvas Initialization
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = container.clientWidth * dpr
      canvas.height = container.clientHeight * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Navigation / Scroll Controls
  const pan = (dx, dy) => {
    setCamera(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }))
  }

  const zoomIn = () => {
    setCamera(prev => ({
      ...prev,
      scale: Math.min(2.5, prev.scale * 1.15)
    }))
  }

  const zoomOut = () => {
    setCamera(prev => ({
      ...prev,
      scale: Math.max(0.35, prev.scale * 0.85)
    }))
  }

  const resetView = () => {
    setCamera({ x: 50, y: 40, scale: 0.95 })
  }

  const fitView = () => {
    if (!engine || !engine.topology || engine.topology.nodes.length === 0) {
      resetView()
      return
    }
    const nodes = engine.topology.nodes
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    nodes.forEach(n => {
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    })

    const container = containerRef.current
    if (!container) return
    const w = container.clientWidth
    const h = container.clientHeight

    const pad = 100
    const spanX = Math.max(200, maxX - minX + pad * 2)
    const spanY = Math.max(200, maxY - minY + pad * 2)

    const scaleX = w / spanX
    const scaleY = h / spanY
    const newScale = Math.min(1.2, Math.max(0.4, Math.min(scaleX, scaleY)))

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    setCamera({
      scale: newScale,
      x: (w / 2) - centerX * newScale,
      y: (h / 2) - centerY * newScale
    })
  }

  // Mouse Down Event
  const handleMouseDown = (e) => {
    if (e.button !== 0) return // Left click only
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const rawX = e.clientX - rect.left
    const rawY = e.clientY - rect.top
    const worldX = (rawX - camera.x) / camera.scale
    const worldY = (rawY - camera.y) / camera.scale

    if (activeTool === 'SELECT' && hoveredNode) {
      // Start dragging device to reposition
      setDraggedNodeId(hoveredNode.id)
      setDragOffset({
        x: worldX - hoveredNode.x,
        y: worldY - hoveredNode.y
      })
      return
    }

    // Otherwise start panning camera
    setIsPanning(true)
    setPanStart({ x: e.clientX - camera.x, y: e.clientY - camera.y })
  }

  // Mouse Move Event
  const handleMouseMove = (e) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const rawX = e.clientX - rect.left
    const rawY = e.clientY - rect.top
    const worldX = (rawX - camera.x) / camera.scale
    const worldY = (rawY - camera.y) / camera.scale
    setMouseWorldPos({ x: worldX, y: worldY })

    // Node Dragging (Reposition Device)
    if (draggedNodeId && engine) {
      const newX = Math.round(worldX - dragOffset.x)
      const newY = Math.round(worldY - dragOffset.y)
      engine.moveNode(draggedNodeId, newX, newY)
      return
    }

    // Camera Panning
    if (isPanning) {
      setCamera(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }))
      return
    }

    // Check hovered node
    let foundNode = null
    if (engine && engine.topology) {
      for (const node of engine.topology.nodes) {
        const radius = node.type === 'router' ? 32 : 28
        const dist = Math.hypot(worldX - node.x, worldY - node.y)
        if (dist <= radius) {
          foundNode = node
          break
        }
      }
    }
    setHoveredNode(foundNode)

    // Check hovered packet
    let foundPacket = null
    if (engine && engine.packets) {
      for (const pkt of engine.packets) {
        if (pkt.currentRenderPos) {
          const dist = Math.hypot(worldX - pkt.currentRenderPos.x, worldY - pkt.currentRenderPos.y)
          if (dist <= 18) {
            foundPacket = pkt
            break
          }
        }
      }
    }
    setHoveredPacket(foundPacket)

    // Check hovered link (if delete tool is active)
    let foundLink = null
    if (activeTool === 'DELETE' && engine && engine.topology && !foundNode) {
      for (const link of engine.topology.links) {
        const u = engine.nodeMap.get(link.from)
        const v = engine.nodeMap.get(link.to)
        if (u && v) {
          const dist = distToSegment({ x: worldX, y: worldY }, u, v)
          if (dist < 10) {
            foundLink = link
            break
          }
        }
      }
    }
    setHoveredLink(foundLink)
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    setDraggedNodeId(null)
  }

  // Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92
    setCamera(prev => ({
      ...prev,
      scale: Math.min(2.5, Math.max(0.35, prev.scale * zoomFactor))
    }))
  }

  // Click Handler based on Active Tool
  const handleClick = () => {
    // 1. Packet Inspection Click
    if (hoveredPacket) {
      onInspectPacket(hoveredPacket)
      return
    }

    // 2. Cisco Connect Tool (Wiring devices)
    if (activeTool === 'CONNECT' && hoveredNode) {
      if (!cableSourceNode) {
        setCableSourceNode(hoveredNode)
        showToast(`🔌 Selected ${hoveredNode.name}. Click another device to connect cable!`, 'info')
      } else {
        if (cableSourceNode.id !== hoveredNode.id) {
          engine.addLink(cableSourceNode.id, hoveredNode.id, {
            bandwidth: 100,
            delay: 5,
            isBottleneckLink: false
          })
          showToast(`✅ Cable connected: ${cableSourceNode.name} ⟷ ${hoveredNode.name}`, 'success')
        }
        setCableSourceNode(null)
      }
      return
    }

    // 3. Cisco Simple PDU Tool (Send Envelope)
    if (activeTool === 'SIMPLE_PDU' && hoveredNode) {
      if (!pduSourceNode) {
        setPduSourceNode(hoveredNode)
        showToast(`✉️ Source device: ${hoveredNode.name}. Click any destination device to send envelope!`, 'info')
      } else {
        if (pduSourceNode.id !== hoveredNode.id) {
          const res = engine.injectCustomPacket({
            srcNodeId: pduSourceNode.id,
            dstNodeId: hoveredNode.id,
            protocol: 'TCP',
            sizeBytes: 1460,
            count: 1,
            flowColor: '#10b981'
          })
          if (res.success) {
            showToast(`✉️ Dispatched packet: ${pduSourceNode.name} ➔ ${hoveredNode.name}!`, 'success')
          } else {
            showToast(`⚠️ ${res.error || 'Failed to send packet'}`, 'error')
          }
        }
        setPduSourceNode(null)
      }
      return
    }

    // 4. Cisco Delete Tool
    if (activeTool === 'DELETE') {
      if (hoveredNode) {
        engine.removeNode(hoveredNode.id)
        setHoveredNode(null)
        return
      }
      if (hoveredLink) {
        engine.removeLink(hoveredLink.id)
        setHoveredLink(null)
        return
      }
    }

    // 5. Select Node for Inspector Modal
    if (activeTool === 'SELECT' && hoveredNode && onSelectNode) {
      onSelectNode(hoveredNode)
    }
  }

  // Canvas Render Loop
  useEffect(() => {
    let animId

    const render = () => {
      const canvas = canvasRef.current
      if (!canvas || !engine) return
      const ctx = canvas.getContext('2d')
      const width = canvas.width / (window.devicePixelRatio || 1)
      const height = canvas.height / (window.devicePixelRatio || 1)

      // Background fill based on theme
      ctx.fillStyle = isDark ? '#0d131f' : '#ffffff'
      ctx.fillRect(0, 0, width, height)

      ctx.save()

      // Apply Pan & Zoom
      ctx.translate(camera.x, camera.y)
      ctx.scale(camera.scale, camera.scale)

      // Draw Workspace Grid
      drawCiscoWorkspaceGrid(ctx, width, height, camera, isDark)

      // Draw Links & Cables
      drawCables(ctx, engine, hoveredLink, activeTool, isDark)

      // Draw In-Progress Rubber Band Cable
      if (activeTool === 'CONNECT' && cableSourceNode) {
        ctx.save()
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2.5
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(cableSourceNode.x, cableSourceNode.y)
        ctx.lineTo(mouseWorldPos.x, mouseWorldPos.y)
        ctx.stroke()
        ctx.restore()
      }

      // Draw In-Progress Rubber Band Envelope (Simple PDU Tool)
      if (activeTool === 'SIMPLE_PDU' && pduSourceNode) {
        ctx.save()
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 2.5
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(pduSourceNode.x, pduSourceNode.y)
        ctx.lineTo(mouseWorldPos.x, mouseWorldPos.y)
        ctx.stroke()
        ctx.font = '20px sans-serif'
        ctx.fillText('✉️', mouseWorldPos.x + 8, mouseWorldPos.y - 8)
        ctx.restore()
      }

      // Draw Packet Envelopes (Cisco Packet Tracer Envelopes ✉️)
      drawPacketEnvelopes(ctx, engine, hoveredPacket, isDark)

      // Draw Dropped Packet Explosion Bursts
      drawDroppedExplosions(ctx, engine)

      // Draw Realistic Cisco Devices (Routers, Switches, PCs, Servers)
      drawCiscoDevices(ctx, engine, hoveredNode, cableSourceNode, pduSourceNode, isDark)

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [camera, engine, hoveredNode, hoveredPacket, hoveredLink, activeTool, cableSourceNode, pduSourceNode, mouseWorldPos, isDark])

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden select-none cursor-crosshair transition-colors duration-200 ${
        isDark ? 'bg-[#0d131f]' : 'bg-white'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* 📢 Canvas Floating Toast Message */}
      {canvasToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top duration-200">
          <div className={`px-4 py-2 rounded-xl shadow-xl font-mono text-xs font-bold flex items-center gap-2 border ${
            canvasToast.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-800'
              : canvasToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-cyan-50 border-cyan-300 text-cyan-800'
          }`}>
            <span>{canvasToast.message}</span>
            <button
              onClick={() => setCanvasToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 🧭 ON-CANVAS NAVIGATION & SCROLL BUTTONS ("Scroll Buttons") */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        {/* Directional Scroll/Pan Compass Pad */}
        <div className={`p-2 rounded-xl shadow-lg border backdrop-blur-md flex flex-col items-center ${
          isDark ? 'bg-slate-900/90 border-slate-700/80 text-white' : 'bg-white/95 border-slate-300 text-slate-800'
        }`}>
          <div className="text-[10px] font-mono text-cyan-600 font-bold mb-1 tracking-wider uppercase">
            Scroll Navigation
          </div>
          {/* Up */}
          <button
            onClick={() => pan(0, 60)}
            className={`w-7 h-7 rounded flex items-center justify-center transition shadow mb-1 ${
              isDark ? 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-cyan-600 text-slate-700 hover:text-white border border-slate-300'
            }`}
            title="Scroll / Pan Up"
          >
            <ChevronUp size={16} />
          </button>
          {/* Left, Center Reset, Right */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => pan(60, 0)}
              className={`w-7 h-7 rounded flex items-center justify-center transition shadow ${
                isDark ? 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-cyan-600 text-slate-700 hover:text-white border border-slate-300'
              }`}
              title="Scroll / Pan Left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={fitView}
              className={`w-7 h-7 rounded font-bold text-[10px] flex items-center justify-center border ${
                isDark ? 'bg-slate-950 hover:bg-slate-800 text-cyan-400 border-cyan-500/40' : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-300'
              }`}
              title="Fit Entire Network to Screen"
            >
              FIT
            </button>
            <button
              onClick={() => pan(-60, 0)}
              className={`w-7 h-7 rounded flex items-center justify-center transition shadow ${
                isDark ? 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-cyan-600 text-slate-700 hover:text-white border border-slate-300'
              }`}
              title="Scroll / Pan Right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Down */}
          <button
            onClick={() => pan(0, -60)}
            className={`w-7 h-7 rounded flex items-center justify-center transition shadow mt-1 ${
              isDark ? 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-cyan-600 text-slate-700 hover:text-white border border-slate-300'
            }`}
            title="Scroll / Pan Down"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className={`p-1.5 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-1 justify-center ${
          isDark ? 'bg-slate-900/90 border-slate-700/80 text-white' : 'bg-white/95 border-slate-300 text-slate-800'
        }`}>
          <button
            onClick={zoomIn}
            className={`w-7 h-7 rounded flex items-center justify-center transition ${
              isDark ? 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-cyan-600 text-slate-700 hover:text-white border border-slate-300'
            }`}
            title="Zoom In (+)"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={resetView}
            className={`px-2 h-7 rounded font-mono text-[11px] font-bold flex items-center justify-center transition ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
            }`}
            title="Reset Zoom to 100%"
          >
            {Math.round(camera.scale * 100)}%
          </button>
          <button
            onClick={zoomOut}
            className={`w-7 h-7 rounded flex items-center justify-center transition ${
              isDark ? 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-cyan-600 text-slate-700 hover:text-white border border-slate-300'
            }`}
            title="Zoom Out (-)"
          >
            <Minus size={15} />
          </button>
        </div>
      </div>

      {/* Active Mode Banner at Top Center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className={`rounded-full px-4 py-1 shadow-md border flex items-center gap-2 text-xs font-mono backdrop-blur-md ${
          isDark ? 'bg-slate-900/90 border-cyan-500/40 text-cyan-300' : 'bg-white/95 border-cyan-500/50 text-cyan-800'
        }`}>
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Tool:</span>
          <span className="font-bold">
            {activeTool === 'SELECT' && 'Selection & Move Mode (Drag Devices to Reposition)'}
            {activeTool === 'CONNECT' && (cableSourceNode ? `Wiring from ${cableSourceNode.name} ➔ Click Target Device` : 'Connect Cable Mode')}
            {activeTool === 'SIMPLE_PDU' && (pduSourceNode ? `Sending PDU from ${pduSourceNode.name} ➔ Click Receiver` : 'Simple PDU (Envelope) Mode')}
            {activeTool === 'DELETE' && 'Delete Mode (Click device or cable to delete)'}
          </span>
        </div>
      </div>

      {/* Hovered Packet PDU Tooltip */}
      {hoveredPacket && (
        <div
          className={`absolute z-30 pointer-events-none rounded-lg p-2.5 shadow-2xl text-xs font-mono border ${
            isDark ? 'bg-slate-950/95 border-cyan-400 text-slate-200' : 'bg-white border-cyan-600 text-slate-800'
          }`}
          style={{
            left: Math.min(window.innerWidth - 280, (hoveredPacket.currentRenderPos?.x || 0) * camera.scale + camera.x + 15),
            top: Math.max(20, (hoveredPacket.currentRenderPos?.y || 0) * camera.scale + camera.y - 45)
          }}
        >
          <div className="text-[11px] font-bold text-cyan-600 flex items-center justify-between pb-1 border-b border-slate-200">
            <span>✉️ Cisco PDU Envelope</span>
            <span className="text-emerald-600 font-bold">({hoveredPacket.protocol || 'TCP'})</span>
          </div>
          <div className="mt-1 space-y-0.5 text-[11px]">
            <div>From: <span className="font-bold">{hoveredPacket.srcIp}</span></div>
            <div>To: <span className="font-bold">{hoveredPacket.dstIp}</span></div>
            <div>Seq: <span className="text-amber-600 font-bold">#{hoveredPacket.seq}</span> | Size: {hoveredPacket.sizeBytes}B</div>
            <div className="flex items-center gap-2 pt-1 font-bold">
              <span>Transfer Progress:</span>
              <span className="text-cyan-700 font-mono">
                {hoveredPacket.queuedAtRouter
                  ? 'QUEUED IN ROUTER BUFFER'
                  : `${Math.min(100, Math.max(0, (hoveredPacket.progress || 0) * 100)).toFixed(1)}%`}
              </span>
            </div>
            <div className="text-cyan-600 text-[10px] mt-1 italic font-semibold">Click envelope to inspect OSI layers</div>
          </div>
        </div>
      )}

      {/* Legend at Bottom Right */}
      <div className={`absolute bottom-4 right-4 z-20 rounded-xl p-2.5 shadow-md border text-[11px] font-mono backdrop-blur-md hidden sm:block ${
        isDark ? 'bg-slate-950/85 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-300 text-slate-600'
      }`}>
        <div className={`font-bold mb-1.5 flex items-center gap-1.5 text-xs ${
          isDark ? 'text-slate-300' : 'text-slate-800'
        }`}>
          <span>✉️ Packet Envelope Types</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-emerald-500 inline-block" />
            <span>TCP Data</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-sky-500 inline-block" />
            <span>TCP ACK</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-amber-500 inline-block" />
            <span>Google BBR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded bg-rose-500 inline-block" />
            <span>Packet Drop ❌</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// HELPER DRAWING FUNCTIONS (Cisco Packet Tracer Style)
// -------------------------------------------------------------

function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y)
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y)
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)))
}

function drawCiscoWorkspaceGrid(ctx, w, h, cam, isDark) {
  const gridSize = 40
  ctx.strokeStyle = isDark ? 'rgba(30, 41, 59, 0.45)' : 'rgba(226, 232, 240, 0.85)'
  ctx.lineWidth = 1

  const startX = -cam.x / cam.scale - 200
  const startY = -cam.y / cam.scale - 200
  const endX = startX + (w / cam.scale) + 400
  const endY = startY + (h / cam.scale) + 400

  ctx.beginPath()
  for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
    ctx.moveTo(x, startY)
    ctx.lineTo(x, endY)
  }
  for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
    ctx.moveTo(startX, y)
    ctx.lineTo(endX, y)
  }
  ctx.stroke()
}

function drawCables(ctx, eng, hoveredLink, activeTool, isDark) {
  if (!eng.topology || !eng.topology.links) return

  eng.topology.links.forEach(link => {
    const fromNode = eng.nodeMap.get(link.from)
    const toNode = eng.nodeMap.get(link.to)
    if (!fromNode || !toNode) return

    const isHovered = hoveredLink && hoveredLink.id === link.id
    const isBottleneck = link.isBottleneckLink

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(fromNode.x, fromNode.y)
    ctx.lineTo(toNode.x, toNode.y)

    if (isHovered && activeTool === 'DELETE') {
      ctx.strokeStyle = '#f43f5e'
      ctx.lineWidth = 4
    } else if (isBottleneck) {
      // Bottleneck Cable (Orange/Amber with dashed WAN style)
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 3
      ctx.setLineDash([8, 4])
    } else {
      // Standard Cisco Copper Cable
      ctx.strokeStyle = isHovered ? '#0284c7' : (isDark ? '#334155' : '#475569')
      ctx.lineWidth = 2.5
    }
    ctx.stroke()

    // Draw Cisco Green Link Interface Status Lights 🟢 at both endpoints
    drawInterfaceLight(ctx, fromNode.x, fromNode.y, toNode.x, toNode.y)
    drawInterfaceLight(ctx, toNode.x, toNode.y, fromNode.x, fromNode.y)

    // Bottleneck indicator label
    if (isBottleneck) {
      const midX = (fromNode.x + toNode.x) / 2
      const midY = (fromNode.y + toNode.y) / 2
      ctx.fillStyle = isDark ? '#0f172a' : '#ffffff'
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(midX - 35, midY - 10, 70, 20, 4)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#d97706'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${link.bandwidth}M WAN`, midX, midY)
    }

    ctx.restore()
  })
}

function drawInterfaceLight(ctx, x1, y1, x2, y2) {
  const dist = 32
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const lx = x1 + Math.cos(angle) * dist
  const ly = y1 + Math.sin(angle) * dist

  // Cisco Green Triangle Link Light 🟢
  ctx.save()
  ctx.translate(lx, ly)
  ctx.rotate(angle)

  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.moveTo(0, -3.5)
  ctx.lineTo(5, 0)
  ctx.lineTo(0, 3.5)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

// Draw Packet Envelopes (Authentic Cisco Packet Tracer ✉️ Envelopes)
function drawPacketEnvelopes(ctx, eng, hoveredPacket, isDark) {
  if (!eng.packets) return

  eng.packets.forEach(pkt => {
    let renderX = 0
    let renderY = 0

    if (pkt.queuedAtRouter) {
      // Stored inside Router's Buffer Queue
      const router = eng.nodeMap.get(pkt.queuedAtRouter)
      const queue = eng.routerQueues.get(pkt.queuedAtRouter)
      if (!router || !queue) return

      const queueIndex = queue.packets.findIndex(p => p.id === pkt.id)
      if (queueIndex === -1) return

      // Stacked neatly in queue rack below router
      renderX = router.x - 30 + (queueIndex % 8) * 8
      renderY = router.y + 44 + Math.floor(queueIndex / 8) * 9

      ctx.save()
      drawSingleEnvelope(ctx, renderX, renderY, pkt, true, false, isDark)
      ctx.restore()

      pkt.currentRenderPos = { x: renderX, y: renderY }
      return
    }

    // Packet in transit along cable link
    const u = pkt.path[pkt.hopIndex]
    const v = pkt.path[pkt.hopIndex + 1]
    const nodeU = eng.nodeMap.get(u)
    const nodeV = eng.nodeMap.get(v)
    if (!nodeU || !nodeV) return

    const t = Math.max(0, Math.min(1, pkt.progress))
    renderX = nodeU.x + (nodeV.x - nodeU.x) * t
    renderY = nodeU.y + (nodeV.y - nodeU.y) * t
    pkt.currentRenderPos = { x: renderX, y: renderY }

    ctx.save()
    drawSingleEnvelope(ctx, renderX, renderY, pkt, false, hoveredPacket?.id === pkt.id, isDark)
    ctx.restore()
  })
}

// Single Envelope Renderer (✉️ with folded flap and protocol tag)
function drawSingleEnvelope(ctx, x, y, pkt, isMini = false, isHovered = false, isDark = false) {
  const w = isMini ? 12 : 24
  const h = isMini ? 8 : 16
  const color = pkt.isAck ? '#0284c7' : (pkt.flowColor || '#059669')

  ctx.translate(x, y)

  // Drop Shadow
  ctx.shadowColor = isHovered ? color : 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = isHovered ? 10 : 4

  // Envelope Body
  ctx.fillStyle = isDark ? '#1e293b' : '#ffffff'
  ctx.strokeStyle = color
  ctx.lineWidth = isMini ? 1 : 1.8
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 2)
  ctx.fill()
  ctx.stroke()

  // Envelope Top Triangular Flap
  ctx.beginPath()
  ctx.moveTo(-w / 2, -h / 2)
  ctx.lineTo(0, isMini ? 0 : 2)
  ctx.lineTo(w / 2, -h / 2)
  ctx.stroke()

  // Color Seal Badge in the center
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, isMini ? 0 : 1, isMini ? 1.5 : 3, 0, Math.PI * 2)
  ctx.fill()

  // Label & Demonstration Transfer Progress (0.01% to 100%)
  if (!isMini) {
    // Protocol & Seq # label above envelope
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const label = pkt.isAck ? `ACK #${pkt.ack || 0}` : `${pkt.protocol || 'TCP'} #${pkt.seq || 0}`
    ctx.fillText(label, 0, -h / 2 - 2)

    // Progress % badge underneath envelope (0.01% to 100%)
    const pct = Math.min(100, Math.max(0, (pkt.progress || 0) * 100))
    const pctStr = pct < 1 && pct > 0 ? `${pct.toFixed(2)}%` : `${pct.toFixed(0)}%`

    ctx.fillStyle = color
    ctx.font = 'bold 8px monospace'
    ctx.textBaseline = 'top'
    ctx.fillText(pctStr, 0, h / 2 + 2)

    // Mini transfer progress bar underneath!
    const barW = 28
    const barH = 3
    const barY = h / 2 + 12
    ctx.fillStyle = isDark ? '#334155' : '#e2e8f0'
    ctx.fillRect(-barW / 2, barY, barW, barH)
    ctx.fillStyle = color
    ctx.fillRect(-barW / 2, barY, (barW * pct) / 100, barH)
  }
}

// Dropped Packet Explosions
function drawDroppedExplosions(ctx, eng) {
  if (!eng.droppedParticles) return
  eng.droppedParticles.forEach(p => {
    ctx.save()
    ctx.fillStyle = `rgba(239, 68, 68, ${p.alpha})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4 * p.alpha, 0, Math.PI * 2)
    ctx.fill()

    // Red X drop mark
    ctx.strokeStyle = `rgba(239, 68, 68, ${p.alpha})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(p.x - 4, p.y - 4)
    ctx.lineTo(p.x + 4, p.y + 4)
    ctx.moveTo(p.x + 4, p.y - 4)
    ctx.lineTo(p.x - 4, p.y + 4)
    ctx.stroke()
    ctx.restore()
  })
}

// Draw Cisco Devices (Routers, Switches, PCs, Servers)
function drawCiscoDevices(ctx, eng, hovered, cableSrc, pduSrc, isDark) {
  if (!eng.topology || !eng.topology.nodes) return

  eng.topology.nodes.forEach(node => {
    const isHovered = hovered && hovered.id === node.id
    const isCableSource = cableSrc && cableSrc.id === node.id
    const isPduSource = pduSrc && pduSrc.id === node.id

    ctx.save()
    ctx.translate(node.x, node.y)

    // Selection Halo
    if (isHovered || isCableSource || isPduSource) {
      ctx.beginPath()
      ctx.arc(0, 0, 36, 0, Math.PI * 2)
      ctx.fillStyle = isPduSource ? 'rgba(16, 185, 129, 0.25)' : (isCableSource ? 'rgba(245, 158, 11, 0.25)' : 'rgba(2, 132, 199, 0.25)')
      ctx.fill()
      ctx.strokeStyle = isPduSource ? '#10b981' : (isCableSource ? '#f59e0b' : '#0284c7')
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    if (node.type === 'router') {
      drawCiscoRouter(ctx, node, eng, isHovered, isDark)
    } else if (node.type === 'switch') {
      drawCiscoSwitch(ctx, node, isHovered, isDark)
    } else if (node.type === 'server') {
      drawCiscoServer(ctx, node, isHovered, isDark)
    } else {
      drawCiscoPc(ctx, node, isHovered, isDark)
    }

    // Device Label & IP underneath
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(node.name, 0, 38)

    ctx.fillStyle = isDark ? '#94a3b8' : '#475569'
    ctx.font = '10px monospace'
    ctx.fillText(node.ip, 0, 50)

    ctx.restore()
  })
}

// 1. Cisco Router (Iconic 3D Blue Cylinder with 4 white cross-arrows ⇄ ⇅)
function drawCiscoRouter(ctx, node, eng, isHovered, isDark) {
  const isBottleneck = node.isBottleneck
  const r = 24

  // Cylinder bottom/side shadow
  ctx.fillStyle = isBottleneck ? '#92400e' : '#0369a1'
  ctx.beginPath()
  ctx.ellipse(0, 6, r, r * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()

  // Cylinder Top Face
  ctx.fillStyle = isBottleneck ? '#d97706' : (isHovered ? '#0ea5e9' : '#0284c7')
  ctx.strokeStyle = isBottleneck ? '#fef3c7' : '#e0f2fe'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Cisco 4-Way Cross Arrows on Router Face ⇄ ⇅
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5

  // Left Arrow ◄
  ctx.beginPath()
  ctx.moveTo(-14, 0)
  ctx.lineTo(-8, -4)
  ctx.lineTo(-8, 4)
  ctx.closePath()
  ctx.fill()

  // Right Arrow ►
  ctx.beginPath()
  ctx.moveTo(14, 0)
  ctx.lineTo(8, -4)
  ctx.lineTo(8, 4)
  ctx.closePath()
  ctx.fill()

  // Top Arrow ▲
  ctx.beginPath()
  ctx.moveTo(0, -9)
  ctx.lineTo(-4, -4)
  ctx.lineTo(4, -4)
  ctx.closePath()
  ctx.fill()

  // Bottom Arrow ▼
  ctx.beginPath()
  ctx.moveTo(0, 9)
  ctx.lineTo(-4, 4)
  ctx.lineTo(4, 4)
  ctx.closePath()
  ctx.fill()

  // Router Buffer Queue Visualizer
  const queue = eng.routerQueues.get(node.id)
  if (queue) {
    const qCount = queue.packets.length
    const qCap = queue.capacity || 20
    const ratio = Math.min(1, qCount / qCap)

    // Buffer Meter bar
    ctx.fillStyle = isDark ? '#0f172a' : '#e2e8f0'
    ctx.fillRect(-24, 18, 48, 6)
    ctx.fillStyle = ratio > 0.8 ? '#ef4444' : (ratio > 0.5 ? '#f59e0b' : '#10b981')
    ctx.fillRect(-24, 18, 48 * ratio, 6)
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1
    ctx.strokeRect(-24, 18, 48, 6)
  }
}

// 2. Cisco Switch (Cisco 2960 Dark metallic box with opposing arrows ⇆)
function drawCiscoSwitch(ctx, node, isHovered, isDark) {
  const w = 48
  const h = 22

  ctx.fillStyle = isHovered ? (isDark ? '#1e293b' : '#cbd5e1') : (isDark ? '#0f172a' : '#334155')
  ctx.strokeStyle = isHovered ? '#0284c7' : '#64748b'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 3)
  ctx.fill()
  ctx.stroke()

  // Port LEDs
  ctx.fillStyle = '#10b981'
  for (let i = -16; i <= 16; i += 8) {
    ctx.fillRect(i, -h / 2 + 3, 3, 3)
  }

  // Switch Opposing Arrows ⇆
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5

  // Top arrow pointing Right
  ctx.beginPath()
  ctx.moveTo(-10, 2)
  ctx.lineTo(4, 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(8, 2)
  ctx.lineTo(4, -1)
  ctx.lineTo(4, 5)
  ctx.closePath()
  ctx.fill()

  // Bottom arrow pointing Left
  ctx.beginPath()
  ctx.moveTo(10, 6)
  ctx.lineTo(-4, 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-8, 6)
  ctx.lineTo(-4, 3)
  ctx.lineTo(-4, 9)
  ctx.closePath()
  ctx.fill()
}

// 3. PC Workstation (Monitor, Desktop Stand & Tower)
function drawCiscoPc(ctx, node, isHovered, isDark) {
  // Monitor Bezel
  ctx.fillStyle = isDark ? '#1e293b' : '#e2e8f0'
  ctx.strokeStyle = isHovered ? '#059669' : (isDark ? '#475569' : '#64748b')
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(-18, -18, 30, 20, 2)
  ctx.fill()
  ctx.stroke()

  // Screen Glow
  ctx.fillStyle = isHovered ? '#0284c7' : '#0369a1'
  ctx.fillRect(-15, -15, 24, 14)

  // Screen Terminal lines
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-12, -12, 10, 1.5)
  ctx.fillRect(-12, -9, 14, 1.5)
  ctx.fillRect(-12, -6, 6, 1.5)

  // Monitor Stand
  ctx.fillStyle = '#64748b'
  ctx.fillRect(-5, 2, 4, 5)
  ctx.fillRect(-9, 7, 12, 2)

  // Tower Computer on the Right
  ctx.fillStyle = isDark ? '#0f172a' : '#cbd5e1'
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(14, -18, 10, 26, 2)
  ctx.fill()
  ctx.stroke()

  // CD slot and Power LED
  ctx.fillStyle = '#94a3b8'
  ctx.fillRect(16, -15, 6, 1.5)
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(19, -9, 1.5, 0, Math.PI * 2)
  ctx.fill()
}

// 4. Cisco Server (Enterprise Rack Tower with drive bays and blinking LEDs)
function drawCiscoServer(ctx, node, isHovered, isDark) {
  const w = 34
  const h = 34

  ctx.fillStyle = isDark ? '#0f172a' : '#334155'
  ctx.strokeStyle = isHovered ? '#7c3aed' : '#64748b'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 3)
  ctx.fill()
  ctx.stroke()

  // Drive Bays
  ctx.fillStyle = isDark ? '#1e293b' : '#1e293b'
  ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w - 8, 6)
  ctx.fillRect(-w / 2 + 4, -h / 2 + 13, w - 8, 6)
  ctx.fillRect(-w / 2 + 4, -h / 2 + 21, w - 8, 6)

  // Server LEDs
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(w / 2 - 6, -h / 2 + 8, 1.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(w / 2 - 10, -h / 2 + 8, 1.5, 0, Math.PI * 2)
  ctx.fill()
}
