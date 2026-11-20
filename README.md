# Cisco Packet Tracer & Congestion Simulator

An interactive, high-performance web-based discrete-event network simulator modeled after **Cisco Packet Tracer**. Designed for building custom networks, crafting custom PDU packet envelopes, and studying TCP congestion control algorithms, buffer dynamics, and end-to-end network latency.

---

## 🚀 Cisco Packet Tracer Features

### 1. Interactive Cisco Network Builder
* **Device Palette (Bottom Shelf)**:
  * **Network Devices**: Cisco 2911 Router, Cisco 2960 Switch, WAN Bottleneck Gateway
  * **End Devices**: PC Workstations (PC-PT), Cloud / Local Servers (Server-PT)
  * **Connections / Cables**: Copper Straight-Through Ethernet Cable, Serial WAN DCE Link
* **Interactive Canvas Tools**:
  * **Select / Move Tool (`V`)**: Drag any PC, router, or switch directly across the canvas to organize your topology.
  * **Connect Cable Tool (`C`)**: Click Device A, then click Device B to string cables with live green interface link lights 🟢.
  * **Delete Tool (`D`)**: Click any device or cable to remove it.
  * **Blank Canvas Mode**: Start from scratch or select from pre-configured enterprise topologies (Spine-Leaf, Classic Dumbbell, Multi-Hop Mesh, Satellite).

### 2. Cisco Packet Envelopes (✉️) & PDU Inspection
* **Authentic PDU Envelopes**:
  * Visual folded letter envelopes traveling along cables with protocol badges:
    * 🟢 **Green ✉️**: TCP Data Packet
    * 🔵 **Cyan ✉️**: TCP ACK Packet
    * 🟡 **Amber ✉️**: Google BBR Pacing
    * 🟣 **Purple ✉️**: UDP Burst
    * 🔴 **Red ✉️ with ❌**: Buffer overflow or channel loss drop
* **PDU Packet Crafter & Generator**:
  * Customize and inject synthetic packet bursts between any source and destination devices.
  * Configure Protocol (TCP Reno, Tahoe, CUBIC, BBR, ICMP Ping, UDP), payload size (64B – 1500B), burst quantity, and envelope badge color.
* **OSI 7-Layer PDU Inspector**:
  * Click any envelope in flight or inside a router queue to view the full OSI model breakdown:
    * **Layer 1 Physical**: In/Out port (`FastEthernet0/1`, `GigabitEthernet0/1`) and link speed.
    * **Layer 2 Data Link**: Ethernet II frame with Source & Destination MAC addresses.
    * **Layer 3 Network**: IPv4 packet header with Source IP, Destination IP, TTL, and protocol ID.
    * **Layer 4 Transport**: TCP/UDP segment with Source/Dest ports, Sequence #, Ack #, and window size.
    * **Layer 7 Application**: Payload content.

### 3. On-Screen Navigation & Scroll Controls ("Schrool Buttons")
* Floating directional **Navigation Pad**:
  * ⬆️ Pan / Scroll Up
  * ⬇️ Pan / Scroll Down
  * ⬅️ Pan / Scroll Left
  * ➡️ Pan / Scroll Right
  * 🎯 Reset View (1:1 / 100%)
  * ⛶ **FIT**: Centers and auto-scales the entire network to fit the screen.
  * ➕ Zoom In & ➖ Zoom Out buttons.

### 4. Understandable Simulation Speed & Playback Controls
* Dedicated playback toolbar with human-readable speed presets:
  * **0.25x Slow-Mo**: Step-by-step slow motion to observe individual packet transitions and buffer queueing.
  * **0.5x Slow**: Steady flow observation.
  * **1.0x Normal**: Realtime network transmission.
  * **2.0x Fast & 4.0x Turbo**: High-throughput buffer stress testing.
* Play, Pause, Discrete Step-Forward, and state reset buttons.

---

## 🛠️ Getting Started

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build

# Code linting
npm run lint
```
