// ─────────────────────────────────────────────
// Contract addresses (Mantle Sepolia)
// ─────────────────────────────────────────────
export const TASK_REGISTRY = '0x78453898e11153bdb7290f4b434d519c8b938304'
export const AGENT_REGISTRY = '0xcc23af94f43ffcfe7348c5135b5d1fb4e148e5f1'
export const TREASURY = '0xa46fb1a257c91f14871daf7d2011b36a210b0747'
export const MANTLE_SCAN = 'https://sepolia.mantlescan.xyz'

// ─────────────────────────────────────────────
// Demo data generator
// ─────────────────────────────────────────────
export function generateDemoData() {
  const taskTemplates = [
    { title: 'Anomaly Detection Scan', desc: 'Monitor wallet 0x742d... for suspicious transactions and rapid sequential trades.' },
    { title: 'Yield Rate Comparison', desc: 'Compare mETH and USDY yield rates across Mantle RWA pools.' },
    { title: 'Liquidity Pool Monitor', desc: 'Watch Merchant Moe MNT/USDC pool depth — alert if TVL drops below 500k.' },
    { title: 'Flash Loan Pattern Detection', desc: 'Scan mempool for flash loan patterns targeting Mantle DEXes.' },
    { title: 'Smart Money Tracking', desc: 'Track top whale wallet movements across Mantle ecosystem.' },
    { title: 'Cross-Pool Arbitrage Scan', desc: 'Detect arbitrage opportunities between Agni Finance and Merchant Moe.' },
  ]
  const statuses = ['Open', 'Open', 'Open', 'Assigned', 'Completed', 'Completed']
  const agentNames = ['YieldBot', 'Sentinel', 'LiquidEye', 'ArbHunter', 'MonitorX']

  const randomHex = (len) => Array(len).fill(0).map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')

  const tasks = []
  for (let i = 1; i <= 12; i++) {
    const tmpl = taskTemplates[i % taskTemplates.length]
    tasks.push({
      id: i,
      title: tmpl.title,
      description: tmpl.desc,
      status: statuses[i % statuses.length],
      bounty: (Math.random() * 5 + 0.5).toFixed(2),
      deadline: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
      creator: `0x${randomHex(40)}`,
    })
  }

  const agents = agentNames.map((name, i) => ({
    id: i + 1,
    name,
    address: `0x${randomHex(40)}`,
    active: i < 3,
    score: Math.floor(Math.random() * 40 + 60),
    tasks: Math.floor(Math.random() * 20 + 5),
    earned: (Math.random() * 10 + 1).toFixed(2),
    successRate: Math.floor(Math.random() * 20 + 80),
    badge: Math.floor(Math.random() * 4 + 1),
  }))

  const payments = []
  for (let i = 1; i <= 8; i++) {
    payments.push({
      taskId: i,
      taskName: taskTemplates[i % taskTemplates.length].title.split(' ').slice(0, 3).join(' '),
      agent: agents[i % agents.length].address,
      amount: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      status: i < 6 ? 'Completed' : 'Pending',
      tx: `0x${randomHex(64)}`,
    })
  }

  const feed = []
  for (let i = 0; i < 10; i++) {
    const pi = i % payments.length
    const ai = i % agents.length
    const events = [
      { type: 'create', text: `Task #${payments[pi].taskId} created — ${payments[pi].taskName}` },
      { type: 'claim', text: `${agents[ai].name} claimed Task #${i + 1}` },
      { type: 'proof', text: `${agents[ai].name} submitted proof for Task #${i + 1}` },
      { type: 'payment', text: `Payment released: ${payments[pi].amount} MNT to ${agents[ai].name}` },
    ]
    feed.push({
      ...events[i % 4],
      time: `${Math.floor(Math.random() * 60)}m ago`,
      tx: payments[pi].tx,
    })
  }

  return { tasks, agents, payments, feed }
}

// ─────────────────────────────────────────────
// Random live event generator
// ─────────────────────────────────────────────
export function generateRandomEvent() {
  const taskTypes = ['Yield Scan', 'Anomaly Check', 'Pool Monitor', 'Arb Detection']
  const botNames = ['YieldBot', 'Sentinel', 'LiquidEye', 'ArbHunter']
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

  const events = [
    { type: 'create', text: `New task created — ${pick(taskTypes)}` },
    { type: 'claim', text: `${pick(botNames)} claimed Task #${Math.floor(Math.random() * 50) + 1}` },
    { type: 'proof', text: `Proof submitted for Task #${Math.floor(Math.random() * 50) + 1} — verified on-chain` },
    { type: 'payment', text: `${(Math.random() * 3 + 0.5).toFixed(2)} MNT released to agent wallet` },
    { type: 'sync', text: 'Agent execution cycle completed — polling for new tasks' },
    { type: 'reputation', text: `Reputation updated: ${pick(botNames)} score +${Math.floor(Math.random() * 8) + 2}` },
  ]

  return {
    ...pick(events),
    time: `${Math.floor(Math.random() * 5) + 1}s ago`,
    tx: null,
  }
}
