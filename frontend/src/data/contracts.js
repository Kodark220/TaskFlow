import { createPublicClient, http, formatEther } from 'viem'

// ─── Mantle Sepolia chain definition ───
export const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MantleScan', url: 'https://sepolia.mantlescan.xyz' },
  },
  testnet: true,
}

// ─── Contract addresses ───
export const TASK_REGISTRY = '0x78453898e11153bdb7290f4b434d519c8b938304'
export const AGENT_REGISTRY = '0xcc23af94f43ffcfe7348c5135b5d1fb4e148e5f1'
export const TREASURY = '0xa46fb1a257c91f14871daf7d2011b36a210b0747'
export const MANTLE_SCAN = 'https://sepolia.mantlescan.xyz'

// ─── ABIs (view functions only) ───
export const TaskRegistryABI = [
  { name: 'taskCounter', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getTask', type: 'function', stateMutability: 'view', inputs: [{ name: 'taskId', type: 'uint256' }], outputs: [{ name: '', type: 'tuple', components: [
    { name: 'id', type: 'uint256' },
    { name: 'creator', type: 'address' },
    { name: 'assignee', type: 'address' },
    { name: 'description', type: 'string' },
    { name: 'successCriteria', type: 'string' },
    { name: 'bountyAmount', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'status', type: 'uint8' },
    { name: 'proofHash', type: 'string' },
    { name: 'paymentReleased', type: 'bool' },
  ]}]},
  { name: 'getOpenTaskCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'createTask', type: 'function', stateMutability: 'payable', inputs: [
    { name: 'description', type: 'string' },
    { name: 'successCriteria', type: 'string' },
    { name: 'bountyAmount', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ], outputs: [{ type: 'uint256' }] },
  { name: 'assignTask', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'taskId', type: 'uint256' }], outputs: [] },
  { name: 'submitProof', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'taskId', type: 'uint256' }, { name: 'proofHash', type: 'string' }], outputs: [] },
  // Events for feed
  { name: 'TaskCreated', type: 'event', inputs: [
    { name: 'taskId', type: 'uint256', indexed: true },
    { name: 'creator', type: 'address', indexed: true },
    { name: 'bountyAmount', type: 'uint256', indexed: false },
    { name: 'deadline', type: 'uint256', indexed: false },
  ]},
  { name: 'TaskAssigned', type: 'event', inputs: [
    { name: 'taskId', type: 'uint256', indexed: true },
    { name: 'assignee', type: 'address', indexed: true },
  ]},
  { name: 'ProofSubmitted', type: 'event', inputs: [
    { name: 'taskId', type: 'uint256', indexed: true },
    { name: 'proofHash', type: 'string', indexed: false },
  ]},
  { name: 'PaymentReleased', type: 'event', inputs: [
    { name: 'taskId', type: 'uint256', indexed: true },
    { name: 'assignee', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ]},
]

export const AgentRegistryABI = [
  { name: 'totalAgents', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getAgent', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'tuple', components: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'wallet', type: 'address' },
    { name: 'name', type: 'string' },
    { name: 'metadataURI', type: 'string' },
    { name: 'status', type: 'uint8' },
    { name: 'registrationTime', type: 'uint256' },
    { name: 'totalTasks', type: 'uint256' },
    { name: 'successfulTasks', type: 'uint256' },
    { name: 'totalEarned', type: 'uint256' },
    { name: 'reputationScore', type: 'uint256' },
  ]}]},
  { name: 'isRegistered', type: 'function', stateMutability: 'view', inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'registerAgent', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'wallet', type: 'address' },
    { name: 'name', type: 'string' },
    { name: 'metadataURI', type: 'string' }
  ], outputs: [{ type: 'uint256' }] },
]

export const TreasuryABI = [
  { name: 'getBalance', type: 'function', stateMutability: 'view', inputs: [], outputs: [
    { name: 'contractBalance', type: 'uint256' },
    { name: 'locked', type: 'uint256' },
    { name: 'available', type: 'uint256' },
  ]},
  { name: 'getEscrow', type: 'function', stateMutability: 'view', inputs: [{ name: 'taskId', type: 'uint256' }], outputs: [{ name: '', type: 'tuple', components: [
    { name: 'taskId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'deposited', type: 'bool' },
    { name: 'released', type: 'bool' },
  ]}]},
  // Events for payment feed
  { name: 'FundsReleased', type: 'event', inputs: [
    { name: 'taskId', type: 'uint256', indexed: true },
    { name: 'agent', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ]},
  { name: 'BountyDeposited', type: 'event', inputs: [
    { name: 'taskId', type: 'uint256', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ]},
]

// ─── Public client for reads ───
export const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http('https://rpc.sepolia.mantle.xyz'),
})

// ─── Status mapping ───
const STATUS_MAP = ['Open', 'Assigned', 'Completed', 'Disputed', 'Expired']
const AGENT_STATUS_MAP = ['Active', 'Paused', 'Banned']

// ─── Data fetchers ───

export async function fetchAllTasks() {
  try {
    const count = await publicClient.readContract({
      address: TASK_REGISTRY,
      abi: TaskRegistryABI,
      functionName: 'taskCounter',
    })
    const n = Number(count)
    if (n === 0) return []

    const promises = []
    for (let i = 1; i <= n; i++) {
      promises.push(
        publicClient.readContract({
          address: TASK_REGISTRY,
          abi: TaskRegistryABI,
          functionName: 'getTask',
          args: [BigInt(i)],
        })
      )
    }
    const results = await Promise.all(promises)
    return results.map(t => ({
      id: Number(t.id),
      creator: t.creator,
      assignee: t.assignee,
      description: t.description,
      successCriteria: t.successCriteria,
      bounty: parseFloat(formatEther(t.bountyAmount)).toFixed(2),
      bountyRaw: t.bountyAmount,
      deadline: formatDeadline(Number(t.deadline)),
      deadlineRaw: Number(t.deadline),
      status: STATUS_MAP[t.status] || 'Unknown',
      proofHash: t.proofHash,
      paymentReleased: t.paymentReleased,
      title: extractTitle(t.description),
    }))
  } catch (err) {
    console.warn('Failed to fetch tasks from chain:', err.message)
    return null // null = use fallback
  }
}

export async function fetchAllAgents() {
  try {
    const count = await publicClient.readContract({
      address: AGENT_REGISTRY,
      abi: AgentRegistryABI,
      functionName: 'totalAgents',
    })
    const n = Number(count)
    if (n === 0) return []

    const promises = []
    for (let i = 1; i <= n; i++) {
      promises.push(
        publicClient.readContract({
          address: AGENT_REGISTRY,
          abi: AgentRegistryABI,
          functionName: 'getAgent',
          args: [BigInt(i)],
        })
      )
    }
    const results = await Promise.all(promises)
    return results.map(a => ({
      id: Number(a.tokenId),
      name: a.name || `Agent #${a.tokenId}`,
      address: a.wallet,
      active: a.status === 0,
      status: AGENT_STATUS_MAP[a.status] || 'Unknown',
      score: Number(a.reputationScore),
      tasks: Number(a.totalTasks),
      earned: parseFloat(formatEther(a.totalEarned)).toFixed(2),
      successRate: a.totalTasks > 0n ? Math.round(Number(a.successfulTasks * 100n / a.totalTasks)) : 0,
      badge: Math.min(Math.floor(Number(a.reputationScore) / 20) + 1, 5),
      registrationTime: Number(a.registrationTime),
    }))
  } catch (err) {
    console.warn('Failed to fetch agents from chain:', err.message)
    return null
  }
}

export async function fetchTreasuryBalance() {
  try {
    const [contractBalance, locked, available] = await publicClient.readContract({
      address: TREASURY,
      abi: TreasuryABI,
      functionName: 'getBalance',
    })
    return {
      total: parseFloat(formatEther(contractBalance)).toFixed(2),
      locked: parseFloat(formatEther(locked)).toFixed(2),
      available: parseFloat(formatEther(available)).toFixed(2),
    }
  } catch (err) {
    console.warn('Failed to fetch treasury balance:', err.message)
    return null
  }
}

export async function fetchRecentEvents() {
  try {
    const blockNumber = await publicClient.getBlockNumber()
    const fromBlock = blockNumber > 5000n ? blockNumber - 5000n : 0n

    const [created, assigned, proofs, payments] = await Promise.all([
      publicClient.getLogs({
        address: TASK_REGISTRY,
        event: TaskRegistryABI.find(e => e.name === 'TaskCreated'),
        fromBlock,
      }),
      publicClient.getLogs({
        address: TASK_REGISTRY,
        event: TaskRegistryABI.find(e => e.name === 'TaskAssigned'),
        fromBlock,
      }),
      publicClient.getLogs({
        address: TASK_REGISTRY,
        event: TaskRegistryABI.find(e => e.name === 'ProofSubmitted'),
        fromBlock,
      }),
      publicClient.getLogs({
        address: TASK_REGISTRY,
        event: TaskRegistryABI.find(e => e.name === 'PaymentReleased'),
        fromBlock,
      }),
    ])

    const events = [
      ...created.map(e => ({
        type: 'create',
        text: `Task #${e.args.taskId} created — ${formatEther(e.args.bountyAmount)} MNT bounty`,
        tx: e.transactionHash,
        block: Number(e.blockNumber),
      })),
      ...assigned.map(e => ({
        type: 'claim',
        text: `Agent ${shortAddr(e.args.assignee)} claimed Task #${e.args.taskId}`,
        tx: e.transactionHash,
        block: Number(e.blockNumber),
      })),
      ...proofs.map(e => ({
        type: 'proof',
        text: `Proof submitted for Task #${e.args.taskId}`,
        tx: e.transactionHash,
        block: Number(e.blockNumber),
      })),
      ...payments.map(e => ({
        type: 'payment',
        text: `${formatEther(e.args.amount)} MNT released to ${shortAddr(e.args.assignee)}`,
        tx: e.transactionHash,
        block: Number(e.blockNumber),
      })),
    ]

    // Sort by block number descending
    events.sort((a, b) => b.block - a.block)

    return events.map(e => ({
      ...e,
      time: 'on-chain',
    }))
  } catch (err) {
    console.warn('Failed to fetch events:', err.message)
    return null
  }
}

// ─── Helpers ───
function shortAddr(addr) {
  if (!addr) return '0x...'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatDeadline(timestamp) {
  const now = Math.floor(Date.now() / 1000)
  const diff = timestamp - now
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / 3600)
  const mins = Math.floor((diff % 3600) / 60)
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  return `${hours}h ${mins}m`
}

function extractTitle(description) {
  // Try to extract a meaningful title from the description
  if (!description) return 'Untitled Task'
  const firstLine = description.split('\n')[0].split('.')[0]
  if (firstLine.length > 50) return firstLine.slice(0, 47) + '...'
  return firstLine || 'Untitled Task'
}
