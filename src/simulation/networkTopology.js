// Realistic network topologies for the Congestion Control Simulator

export const TOPOLOGIES = {
  SPINE_LEAF_ENTERPRISE: {
    id: 'SPINE_LEAF_ENTERPRISE',
    name: 'Spine-Leaf Enterprise Backbone (14 Nodes)',
    description: 'Multi-source enterprise campus with aggregation switches, redundant core routers, and a dynamic WAN bottleneck gateway leading to cloud servers.',
    defaultBottleneckId: 'r_bottleneck',
    nodes: [
      // Client Sources
      { id: 'h1', name: 'Workstation Alpha', type: 'host', ip: '10.10.1.101', subnet: '10.10.1.0/24', x: 80, y: 130, flowColor: '#00f0ff', active: true },
      { id: 'h2', name: 'Compute Node Beta', type: 'host', ip: '10.10.1.102', subnet: '10.10.1.0/24', x: 80, y: 260, flowColor: '#10b981', active: true },
      { id: 'h3', name: 'Streamer Gamma', type: 'host', ip: '10.10.2.103', subnet: '10.10.2.0/24', x: 80, y: 410, flowColor: '#a855f7', active: true },
      { id: 'h4', name: 'Backup Agent Delta', type: 'host', ip: '10.10.2.104', subnet: '10.10.2.0/24', x: 80, y: 540, flowColor: '#f59e0b', active: false },

      // Aggregation Layer
      { id: 'sw_agg1', name: 'Agg-Switch-01', type: 'switch', ip: '10.10.1.1', subnet: '10.10.1.0/24', x: 260, y: 195, bufferSize: 30 },
      { id: 'sw_agg2', name: 'Agg-Switch-02', type: 'switch', ip: '10.10.2.1', subnet: '10.10.2.0/24', x: 260, y: 475, bufferSize: 30 },

      // Core Layer
      { id: 'r_core1', name: 'Core-Router-North', type: 'router', ip: '172.16.1.1', subnet: '172.16.1.0/24', x: 440, y: 240, bufferSize: 40 },
      { id: 'r_core2', name: 'Core-Router-South', type: 'router', ip: '172.16.1.2', subnet: '172.16.1.0/24', x: 440, y: 430, bufferSize: 40 },

      // Bottleneck WAN Gateway (Crucial for Congestion Analysis)
      { id: 'r_bottleneck', name: 'WAN-Edge-Bottleneck', type: 'router', ip: '203.0.113.1', subnet: '203.0.113.0/30', x: 640, y: 335, bufferSize: 22, isBottleneck: true },

      // Cloud Distribution Layer
      { id: 'r_cloud1', name: 'Cloud-Gateway-01', type: 'router', ip: '198.51.100.1', subnet: '198.51.100.0/24', x: 840, y: 240, bufferSize: 35 },
      { id: 'r_cloud2', name: 'Cloud-Gateway-02', type: 'router', ip: '198.51.100.2', subnet: '198.51.100.0/24', x: 840, y: 430, bufferSize: 35 },

      // Cloud Server Destinations
      { id: 'srv_web', name: 'Web/API Cluster', type: 'server', ip: '198.51.100.10', subnet: '198.51.100.0/24', x: 1040, y: 180 },
      { id: 'srv_db', name: 'DB Data Lake', type: 'server', ip: '198.51.100.20', subnet: '198.51.100.0/24', x: 1040, y: 335 },
      { id: 'srv_cdn', name: 'CDN Object Vault', type: 'server', ip: '198.51.100.30', subnet: '198.51.100.0/24', x: 1040, y: 490 },
    ],
    links: [
      // Hosts to Agg Switches (High capacity LAN links)
      { id: 'l_h1_sw1', from: 'h1', to: 'sw_agg1', bandwidth: 100, delay: 2, status: 'up' },
      { id: 'l_h2_sw1', from: 'h2', to: 'sw_agg1', bandwidth: 100, delay: 2, status: 'up' },
      { id: 'l_h3_sw2', from: 'h3', to: 'sw_agg2', bandwidth: 100, delay: 3, status: 'up' },
      { id: 'l_h4_sw2', from: 'h4', to: 'sw_agg2', bandwidth: 100, delay: 3, status: 'up' },

      // Agg Switches to Core Routers (Meshed campus links)
      { id: 'l_sw1_c1', from: 'sw_agg1', to: 'r_core1', bandwidth: 80, delay: 4, status: 'up' },
      { id: 'l_sw1_c2', from: 'sw_agg1', to: 'r_core2', bandwidth: 60, delay: 5, status: 'up' },
      { id: 'l_sw2_c1', from: 'sw_agg2', to: 'r_core1', bandwidth: 60, delay: 5, status: 'up' },
      { id: 'l_sw2_c2', from: 'sw_agg2', to: 'r_core2', bandwidth: 80, delay: 4, status: 'up' },

      // Core Routers to Bottleneck Gateway
      { id: 'l_c1_btn', from: 'r_core1', to: 'r_bottleneck', bandwidth: 40, delay: 8, status: 'up' },
      { id: 'l_c2_btn', from: 'r_core2', to: 'r_bottleneck', bandwidth: 40, delay: 8, status: 'up' },

      // Bottleneck Router to Cloud Gateways (The primary WAN constraint!)
      { id: 'l_btn_cg1', from: 'r_bottleneck', to: 'r_cloud1', bandwidth: 16, delay: 25, isBottleneckLink: true, status: 'up' },
      { id: 'l_btn_cg2', from: 'r_bottleneck', to: 'r_cloud2', bandwidth: 16, delay: 25, isBottleneckLink: true, status: 'up' },

      // Cloud Gateways to Servers
      { id: 'l_cg1_web', from: 'r_cloud1', to: 'srv_web', bandwidth: 100, delay: 3, status: 'up' },
      { id: 'l_cg1_db',  from: 'r_cloud1', to: 'srv_db',  bandwidth: 100, delay: 3, status: 'up' },
      { id: 'l_cg2_db',  from: 'r_cloud2', to: 'srv_db',  bandwidth: 100, delay: 3, status: 'up' },
      { id: 'l_cg2_cdn', from: 'r_cloud2', to: 'srv_cdn', bandwidth: 100, delay: 4, status: 'up' },
    ]
  },

  MULTI_PATH_MESH: {
    id: 'MULTI_PATH_MESH',
    name: 'Redundant Multi-Path Mesh (16 Nodes)',
    description: 'High-availability mesh network with dual parallel bottleneck corridors, dynamic load balancing, and alternate failover paths.',
    defaultBottleneckId: 'r_mesh_hub',
    nodes: [
      { id: 'm_h1', name: 'Fintech Terminal 1', type: 'host', ip: '10.200.1.10', subnet: '10.200.1.0/24', x: 80, y: 160, flowColor: '#00f0ff', active: true },
      { id: 'm_h2', name: 'Trading Engine 2', type: 'host', ip: '10.200.1.20', subnet: '10.200.1.0/24', x: 80, y: 340, flowColor: '#10b981', active: true },
      { id: 'm_h3', name: 'Analytics Feeder', type: 'host', ip: '10.200.2.30', subnet: '10.200.2.0/24', x: 80, y: 510, flowColor: '#a855f7', active: true },

      { id: 'm_sw1', name: 'Edge-Switch-A', type: 'switch', ip: '10.200.1.1', subnet: '10.200.1.0/24', x: 260, y: 250, bufferSize: 28 },
      { id: 'm_sw2', name: 'Edge-Switch-B', type: 'switch', ip: '10.200.2.1', subnet: '10.200.2.0/24', x: 260, y: 510, bufferSize: 28 },

      { id: 'm_r1', name: 'Border-Router-Alpha', type: 'router', ip: '172.20.1.1', subnet: '172.20.1.0/24', x: 440, y: 180, bufferSize: 32 },
      { id: 'm_r2', name: 'Border-Router-Beta', type: 'router', ip: '172.20.2.1', subnet: '172.20.2.0/24', x: 440, y: 370, bufferSize: 32 },
      { id: 'm_r3', name: 'Border-Router-Gamma', type: 'router', ip: '172.20.3.1', subnet: '172.20.3.0/24', x: 440, y: 540, bufferSize: 32 },

      { id: 'r_mesh_hub', name: 'Transit-Backbone-Hub', type: 'router', ip: '198.18.0.1', subnet: '198.18.0.0/16', x: 650, y: 340, bufferSize: 20, isBottleneck: true },

      { id: 'm_r4', name: 'Transit-Egress-North', type: 'router', ip: '198.18.1.1', subnet: '198.18.1.0/24', x: 840, y: 220, bufferSize: 30 },
      { id: 'm_r5', name: 'Transit-Egress-South', type: 'router', ip: '198.18.2.1', subnet: '198.18.2.0/24', x: 840, y: 460, bufferSize: 30 },

      { id: 'm_srv1', name: 'Primary Exchange Matching', type: 'server', ip: '192.168.50.10', subnet: '192.168.50.0/24', x: 1040, y: 220 },
      { id: 'm_srv2', name: 'Sec-Exchange Clearing', type: 'server', ip: '192.168.50.20', subnet: '192.168.50.0/24', x: 1040, y: 460 },
    ],
    links: [
      { id: 'ml_1', from: 'm_h1', to: 'm_sw1', bandwidth: 100, delay: 2, status: 'up' },
      { id: 'ml_2', from: 'm_h2', to: 'm_sw1', bandwidth: 100, delay: 2, status: 'up' },
      { id: 'ml_3', from: 'm_h3', to: 'm_sw2', bandwidth: 100, delay: 2, status: 'up' },
      { id: 'ml_4', from: 'm_sw1', to: 'm_r1', bandwidth: 70, delay: 4, status: 'up' },
      { id: 'ml_5', from: 'm_sw1', to: 'm_r2', bandwidth: 70, delay: 4, status: 'up' },
      { id: 'ml_6', from: 'm_sw2', to: 'm_r2', bandwidth: 50, delay: 6, status: 'up' },
      { id: 'ml_7', from: 'm_sw2', to: 'm_r3', bandwidth: 70, delay: 4, status: 'up' },
      { id: 'ml_8', from: 'm_r1', to: 'r_mesh_hub', bandwidth: 35, delay: 10, status: 'up' },
      { id: 'ml_9', from: 'm_r2', to: 'r_mesh_hub', bandwidth: 20, delay: 12, isBottleneckLink: true, status: 'up' },
      { id: 'ml_10', from: 'm_r3', to: 'r_mesh_hub', bandwidth: 30, delay: 11, status: 'up' },
      { id: 'ml_11', from: 'r_mesh_hub', to: 'm_r4', bandwidth: 22, delay: 15, isBottleneckLink: true, status: 'up' },
      { id: 'ml_12', from: 'r_mesh_hub', to: 'm_r5', bandwidth: 22, delay: 15, isBottleneckLink: true, status: 'up' },
      { id: 'ml_13', from: 'm_r4', to: 'm_srv1', bandwidth: 100, delay: 3, status: 'up' },
      { id: 'ml_14', from: 'm_r5', to: 'm_srv2', bandwidth: 100, delay: 3, status: 'up' },
      { id: 'ml_15', from: 'm_r4', to: 'm_srv2', bandwidth: 80, delay: 5, status: 'up' },
    ]
  },

  TRANSCONTINENTAL_WAN: {
    id: 'TRANSCONTINENTAL_WAN',
    name: 'Transcontinental High-BDP Satellite/Fiber (10 Nodes)',
    description: 'High Bandwidth-Delay Product (BDP) environment (80-160ms RTT) designed to compare modern BBR and CUBIC against traditional Tahoe and Reno.',
    defaultBottleneckId: 'r_sat_uplink',
    nodes: [
      { id: 'sat_h1', name: 'London Station HQ', type: 'host', ip: '10.50.1.10', subnet: '10.50.1.0/24', x: 100, y: 220, flowColor: '#00f0ff', active: true },
      { id: 'sat_h2', name: 'Frankfurt Branch', type: 'host', ip: '10.50.1.20', subnet: '10.50.1.0/24', x: 100, y: 440, flowColor: '#10b981', active: true },

      { id: 'sat_gw_eu', name: 'Euro-Gateway', type: 'router', ip: '194.109.6.1', subnet: '194.109.6.0/24', x: 320, y: 330, bufferSize: 35 },

      { id: 'r_sat_uplink', name: 'Subsea-Fiber-Gateway', type: 'router', ip: '195.66.225.1', subnet: '195.66.225.0/30', x: 550, y: 330, bufferSize: 28, isBottleneck: true },

      { id: 'sat_gw_us', name: 'US-East-Gateway', type: 'router', ip: '198.32.160.1', subnet: '198.32.160.0/24', x: 780, y: 330, bufferSize: 35 },

      { id: 'sat_srv1', name: 'Tokyo-US Sync DC', type: 'server', ip: '192.0.2.55', subnet: '192.0.2.0/24', x: 1000, y: 220 },
      { id: 'sat_srv2', name: 'Singapore Mirror', type: 'server', ip: '192.0.2.88', subnet: '192.0.2.0/24', x: 1000, y: 440 },
    ],
    links: [
      { id: 'sl_1', from: 'sat_h1', to: 'sat_gw_eu', bandwidth: 100, delay: 5, status: 'up' },
      { id: 'sl_2', from: 'sat_h2', to: 'sat_gw_eu', bandwidth: 100, delay: 6, status: 'up' },
      { id: 'sl_3', from: 'sat_gw_eu', to: 'r_sat_uplink', bandwidth: 50, delay: 15, status: 'up' },
      { id: 'sl_4', from: 'r_sat_uplink', to: 'sat_gw_us', bandwidth: 20, delay: 70, isBottleneckLink: true, status: 'up' }, // 70ms propagation delay
      { id: 'sl_5', from: 'sat_gw_us', to: 'sat_srv1', bandwidth: 80, delay: 10, status: 'up' },
      { id: 'sl_6', from: 'sat_gw_us', to: 'sat_srv2', bandwidth: 80, delay: 12, status: 'up' },
    ]
  },

  DUMBBELL_CLASSIC: {
    id: 'DUMBBELL_CLASSIC',
    name: 'Classic Dumbbell Topology (6 Nodes)',
    description: 'The canonical congestion control benchmark: dual client hosts converging through a single bottleneck router to a destination server.',
    defaultBottleneckId: 'r_btn',
    nodes: [
      { id: 'h1', name: 'PC 1 (Sender A)', type: 'host', ip: '192.168.1.10', subnet: '192.168.1.0/24', x: 120, y: 180, flowColor: '#00f0ff', active: true },
      { id: 'h2', name: 'PC 2 (Sender B)', type: 'host', ip: '192.168.1.20', subnet: '192.168.1.0/24', x: 120, y: 420, flowColor: '#10b981', active: true },
      { id: 'sw1', name: 'Access Switch', type: 'switch', ip: '192.168.1.1', subnet: '192.168.1.0/24', x: 340, y: 300, bufferSize: 30 },
      { id: 'r_btn', name: 'Bottleneck Router', type: 'router', ip: '10.0.0.1', subnet: '10.0.0.0/30', x: 600, y: 300, bufferSize: 20, isBottleneck: true },
      { id: 'r_dst', name: 'Destination Gateway', type: 'router', ip: '10.0.0.2', subnet: '10.0.0.0/30', x: 860, y: 300, bufferSize: 30 },
      { id: 'srv1', name: 'Target Server', type: 'server', ip: '172.16.0.10', subnet: '172.16.0.0/24', x: 1080, y: 300 },
    ],
    links: [
      { id: 'dl_1', from: 'h1', to: 'sw1', bandwidth: 100, delay: 2, status: 'up' },
      { id: 'dl_2', from: 'h2', to: 'sw1', bandwidth: 100, delay: 2, status: 'up' },
      { id: 'dl_3', from: 'sw1', to: 'r_btn', bandwidth: 80, delay: 4, status: 'up' },
      { id: 'dl_4', from: 'r_btn', to: 'r_dst', bandwidth: 16, delay: 25, isBottleneckLink: true, status: 'up' },
      { id: 'dl_5', from: 'r_dst', to: 'srv1', bandwidth: 100, delay: 2, status: 'up' },
    ]
  },

  BLANK_CUSTOM: {
    id: 'BLANK_CUSTOM',
    name: 'Blank Canvas (Build Your Own Network)',
    description: 'Start from scratch! Add Cisco routers, switches, PCs, servers and connect them with cables.',
    nodes: [],
    links: []
  }
}
