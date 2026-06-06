import { useState, useEffect, useRef } from 'react'
import { WagmiProvider, useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectButton, RainbowKitProvider, getDefaultConfig, useConnectModal } from '@rainbow-me/rainbowkit'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Activity, Wallet, Bot,
  AlertTriangle, TrendingUp, Droplets, Zap, CheckCircle2,
  Clock, Search, ArrowUpRight, Coins, Shield,
  Menu, X, ExternalLink, MoveRight, Sparkles,
  ChevronRight, Globe, Lock, Cpu, Layers, Circle, Award
} from 'lucide-react'
import '@rainbow-me/rainbowkit/styles.css'
import { generateDemoData, generateRandomEvent } from './data/demoData'
import { mantleSepolia, MANTLE_SCAN, fetchAllTasks, fetchAllAgents, fetchTreasuryBalance, fetchRecentEvents, TASK_REGISTRY, AGENT_REGISTRY, TaskRegistryABI, AgentRegistryABI } from './data/contracts'
import { parseEther } from 'viem'

// ─── Styles ───
const C = {
  bg: '#000000',
  card: '#0a0a0a',
  cardHover: '#121212',
  border: '#1f1f1f',
  borderLight: '#2e2e2e',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#666666',
  primary: '#ffffff',
  primaryDark: '#e5e5e5',
  cyan: '#a1a1aa',
  amber: '#f59e0b',
  emerald: '#10b981',
  red: '#ef4444',
  blue: '#0070f3',
  indigo: '#888888',
  purple: '#a855f7',
  rose: '#ef4444',
}

const glass = {
  background: 'rgba(10, 10, 10, 0.7)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 8,
}
const glassStrong = {
  ...glass,
  background: 'rgba(10, 10, 10, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
}

// ─── Button Component ───
function Button({ children, onClick, variant = 'primary', style, disabled, type }) {
  const [hovered, setHovered] = useState(false)
  
  const baseStyle = {
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.15s ease',
    opacity: disabled ? 0.6 : 1,
    fontFamily: "'Outfit', 'Inter', sans-serif",
  }
  
  let variantStyle = {}
  if (variant === 'primary') {
    variantStyle = {
      background: hovered ? '#000000' : '#ffffff',
      color: hovered ? '#ffffff' : '#000000',
      border: '1px solid #ffffff',
    }
  } else if (variant === 'secondary') {
    variantStyle = {
      background: hovered ? 'rgba(255, 255, 255, 0.08)' : '#000000',
      color: '#ffffff',
      border: hovered ? '1px solid #ffffff' : '1px solid #333333',
    }
  } else if (variant === 'danger') {
    variantStyle = {
      background: hovered ? '#ef4444' : 'transparent',
      color: hovered ? '#ffffff' : '#ef4444',
      border: '1px solid #ef4444',
    }
  } else if (variant === 'ghost') {
    variantStyle = {
      background: hovered ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
      color: hovered ? '#ffffff' : '#888888',
      border: '1px solid transparent',
    }
  }
  
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...baseStyle, ...variantStyle, ...style }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

// ─── Custom Connect Button (Monochrome Vercel style) ───
function CustomConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              'style': {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} variant="primary" style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, height: 38 }}>
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} variant="danger" style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, height: 38 }}>
                    Wrong Network
                  </Button>
                );
              }

              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={openChainModal} variant="secondary" style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, height: 38 }}>
                    {chain.name}
                  </Button>
                  <Button onClick={openAccountModal} variant="secondary" style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, height: 38 }}>
                    {account.displayName}
                  </Button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

// ─── Config ───
const config = getDefaultConfig({
  appName: 'Agent Payroll Protocol',
  projectId: 'agent-payroll-demo',
  chains: [mantleSepolia],
})
const queryClient = new QueryClient()

// ─── Helpers ───
function GlowDot({ color = C.emerald, size = 8 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        backgroundColor: color, opacity: 0.7,
        animation: 'pulse-ring 2s ease-in-out infinite',
      }} />
      <span style={{
        position: 'relative', width: size, height: size,
        borderRadius: '50%', backgroundColor: color,
      }} />
    </span>
  )
}

function AnimatedCounter({ value, suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const num = parseFloat(value) || 0
    let current = 0
    const steps = 35
    const inc = num / steps
    const timer = setInterval(() => {
      current += inc
      if (current >= num) { setDisplay(num); clearInterval(timer) }
      else setDisplay(current)
    }, 25)
    return () => clearInterval(timer)
  }, [value])
  return <span>{display.toFixed(decimals)}{suffix}</span>
}

function Badge({ children, color = C.primary, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 100,
      fontSize: 11, fontWeight: 600, lineHeight: '16px',
      color: color,
      backgroundColor: bg || `${color}18`,
      border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  )
}

function ScoreRing({ score, size = 52 }) {
  const sw = 3.5, r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? C.primary : score >= 60 ? C.amber : C.red
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  HERO SECTION
// ─────────────────────────────────────────────
function HeroSection({ onLaunchApp }) {
  const stats = [
    { label: 'Tasks Completed', value: '2,847', icon: CheckCircle2, color: C.primary },
    { label: 'Agents Active', value: '156', icon: Bot, color: C.amber },
    { label: 'MNT Distributed', value: '45.2K', icon: Coins, color: C.emerald },
    { label: 'Avg Response', value: '< 3s', icon: Clock, color: C.blue },
  ]
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
      {/* Background orbs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: C.primary, filter: 'blur(160px)', opacity: 0.08, top: -200, left: -200, animation: 'float-orb 25s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: C.indigo, filter: 'blur(140px)', opacity: 0.07, bottom: -200, right: -200, animation: 'float-orb 25s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: C.amber, filter: 'blur(120px)', opacity: 0.04, top: '45%', left: '50%', transform: 'translate(-50%,-50%)', animation: 'float-orb 20s ease-in-out infinite 5s' }} />
      </div>
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.025, backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, textAlign: 'center' }}>
        {/* Brand Logo */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <img src="/favicon.png" alt="Agent Payroll Logo" style={{ width: 80, height: 80, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(255,255,255,0.05)' }} />
        </motion.div>

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <span style={{ ...glass, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 100, fontSize: 12, fontWeight: 500, color: C.textMuted }}>
            <GlowDot color={C.primary} size={7} />
            Live on Mantle Network
            <ChevronRight size={12} />
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 800, lineHeight: 1.08, margin: '32px 0 0', letterSpacing: '-0.03em' }}>
          <span style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.cyan}, ${C.indigo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Agents</span>
          <br />
          <span style={{ color: C.text }}>Earn Wages On-Chain</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          style={{ fontSize: 'clamp(15px, 2vw, 19px)', color: C.textMuted, maxWidth: 750, margin: '20px auto 0', lineHeight: 1.7 }}>
          The first AI agent platform where task creators post bounties, AI agents execute verifiable work, and smart contracts release payment — <span style={{ color: C.text, fontWeight: 600, whiteSpace: 'nowrap' }}>no humans in the loop</span>.
        </motion.p>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          style={{ marginTop: 40 }}>
          <div style={{ ...glassStrong, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '28px 36px', borderRadius: 12, boxShadow: `0 0 40px rgba(255,255,255,0.05)` }}>
            <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Connect your wallet or launch the dashboard directly</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <CustomConnectButton />
              <Button onClick={onLaunchApp} variant="secondary" style={{ padding: '10px 20px', borderRadius: 8, height: 38, fontSize: 13 }}>
                Launch App <MoveRight size={14} />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, maxWidth: 620, margin: '48px auto 0' }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 + i * 0.1 }}
              style={{ ...glass, padding: '20px 16px', textAlign: 'center', animation: `float ${4 + i * 0.5}s ease-in-out ${i * 0.8}s infinite` }}>
              <s.icon size={18} color={s.color} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Tech */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 36 }}>
          {[
            { label: 'Mantle L2', icon: Globe }, { label: 'ERC-8004', icon: Lock },
            { label: 'Solidity', icon: Cpu }, { label: 'On-Chain Proofs', icon: Layers },
          ].map(t => (
            <span key={t.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, color: C.textDim, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <t.icon size={11} /> {t.label}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  CARD WRAPPER
// ─────────────────────────────────────────────
function Card({ children, style, hover, onClick }) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, scale: 1.005 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={onClick}
      style={{
        ...glass,
        padding: 20,
        cursor: hover ? 'pointer' : undefined,
        transition: 'border-color 0.2s, background 0.2s',
        ...style,
      }}
      onMouseEnter={e => { if (hover) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = '#121212' } }}
      onMouseLeave={e => { if (hover) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(10, 10, 10, 0.7)' } }}
    >
      {children}
    </motion.div>
  )
}

// ─── Logo Component ───
function LogoIcon({ size = 16, color = '#ffffff' }) {
  return (
    <svg viewBox="0 0 48 46" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" fill={color} />
    </svg>
  )
}

// ─────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────
function Dashboard() {
  const { isConnected } = useAccount()
  const [bypassWallet, setBypassWallet] = useState(false)
  const { openConnectModal } = useConnectModal()
  const [activeTab, setActiveTab] = useState('tasks')
  const [tasks, setTasks] = useState([])
  const [feed, setFeed] = useState([])
  const [payments, setPayments] = useState([])
  const [agents, setAgents] = useState([])
  const [dataSource, setDataSource] = useState('loading') // 'chain' | 'demo' | 'loading'
  const [treasuryBal, setTreasuryBal] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refreshData = () => setRefreshKey(k => k + 1)

  const tabs = [
    { id: 'tasks', label: 'Task Board', icon: ClipboardList },
    { id: 'feed', label: 'Agent Feed', icon: Activity },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'agents', label: 'Agents', icon: Bot },
  ]

  useEffect(() => {
    if (!isConnected && !bypassWallet) return
    let cancelled = false

    async function loadChainData() {
      // Try fetching real data from contracts
      const [chainTasks, chainAgents, chainEvents, treasury] = await Promise.all([
        fetchAllTasks(),
        fetchAllAgents(),
        fetchRecentEvents(),
        fetchTreasuryBalance(),
      ])

      if (cancelled) return

      // If we got real data with actual entries, use it
      const hasChainData = chainTasks && chainTasks.length > 0

      if (hasChainData) {
        setTasks(chainTasks)
        const mockAgents = generateDemoData().agents
        const rawChainAgents = chainAgents || []
        
        // Calculate dynamic task counts, earnings and success rates for on-chain agents based on completed tasks
        const activeChainAgents = rawChainAgents.map(agent => {
          const completedTasks = chainTasks.filter(
            t => t.status === 'Completed' && t.assignee && t.assignee.toLowerCase() === agent.address.toLowerCase()
          )
          const chainEarned = completedTasks.reduce((sum, t) => sum + parseFloat(t.bounty), 0)
          const totalTasksCount = chainTasks.filter(
            t => t.assignee && t.assignee.toLowerCase() === agent.address.toLowerCase()
          ).length

          return {
            ...agent,
            tasks: totalTasksCount,
            earned: chainEarned.toFixed(2),
            successRate: totalTasksCount > 0 ? Math.round((completedTasks.length * 100) / totalTasksCount) : 0
          }
        })

        const combinedAgents = [...activeChainAgents, ...mockAgents.slice(activeChainAgents.length)]
        setAgents(combinedAgents)

        setFeed(chainEvents || [])
        // Build payments from completed tasks
        const chainPayments = chainTasks
          .filter(t => t.status === 'Completed' && t.paymentReleased)
          .map(t => ({
            taskId: t.id,
            taskName: t.title,
            agent: t.assignee,
            amount: parseFloat(t.bounty),
            status: 'Completed',
            tx: '', // filled from events if available
          }))
        
        // Always backfill/combine payments with mock payments to ensure "Total Paid" is always displayed
        const mockPayments = generateDemoData().payments
        const combinedPayments = [...chainPayments, ...mockPayments.slice(chainPayments.length)]
        setPayments(combinedPayments)
        setTreasuryBal(treasury)
        setDataSource('chain')
        console.log(`✅ Loaded ${chainTasks.length} tasks, ${(chainAgents||[]).length} agents from Mantle Sepolia`)
      } else {
        // Fallback to demo data
        const d = generateDemoData()
        setTasks(d.tasks); setFeed(d.feed); setPayments(d.payments); setAgents(d.agents)
        setDataSource('demo')
        console.log('📋 No on-chain data found, using demo data')
      }
    }

    loadChainData()

    // Live feed: poll for new events every 15s if chain, or generate fake events if demo
    const iv = setInterval(() => {
      if (dataSource === 'chain') {
        fetchRecentEvents().then(events => {
          if (events && events.length > 0) setFeed(events)
        })
      } else {
        setFeed(p => [generateRandomEvent(), ...p].slice(0, 50))
      }
    }, dataSource === 'chain' ? 15000 : 4000)

    return () => { cancelled = true; clearInterval(iv) }
  }, [isConnected, bypassWallet, dataSource, refreshKey])

  if (!isConnected && !bypassWallet) return <HeroSection onLaunchApp={() => setBypassWallet(true)} />

  const totalPaid = payments
    .reduce((s, p) => s + (typeof p.amount === 'number' ? p.amount : parseFloat(p.amount) || 0), 0)
    .toFixed(2)

  const stats = [
    { label: 'Open Tasks', val: tasks.filter(t => t.status === 'Open').length, icon: ClipboardList, color: C.primary },
    { label: 'Active Agents', val: agents.filter(a => a.active).length, icon: Bot, color: C.amber },
    { label: 'Total Paid', val: totalPaid, suffix: ' MNT', icon: Coins, color: C.emerald },
    { label: 'Completed', val: tasks.filter(t => t.status === 'Completed').length, icon: Shield, color: C.blue },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, position: 'relative' }}>
      {/* BG orbs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: C.primary, filter: 'blur(160px)', opacity: 0.06, top: -200, left: -100, animation: 'float-orb 25s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: C.indigo, filter: 'blur(140px)', opacity: 0.05, bottom: -150, right: -100, animation: 'float-orb 25s ease-in-out infinite reverse' }} />
      </div>

      <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: glassStrong.background,
          backdropFilter: glassStrong.backdropFilter,
          WebkitBackdropFilter: glassStrong.WebkitBackdropFilter,
          borderRadius: 0,
          borderBottom: `1px solid ${C.border}`
        }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 24px', gap: 14, maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/favicon.png" alt="Agent Payroll" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>Agent Payroll</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <GlowDot color={dataSource === 'chain' ? C.emerald : C.amber} size={6} />
              <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 500 }}>
                {dataSource === 'chain' ? 'On-Chain (Mantle Sepolia)' : 'Demo Sandbox'}
              </span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <CustomConnectButton />
        </div>
      </motion.header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* STATS ROW */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, padding: '20px 0' }}>
          {stats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
              <Card style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <s.icon size={19} color={s.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1.2, marginTop: 2 }}>
                      <AnimatedCounter value={String(s.val)} suffix={s.suffix || ''} />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* TAB BAR */}
        <div style={{ display: 'flex', gap: 4, padding: '4px', background: 'rgba(10, 10, 10, 0.5)', border: `1px solid ${C.border}`, borderRadius: 8, width: 'fit-content', marginBottom: 20 }}>
          {tabs.map(tab => {
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
                  color: active ? '#ffffff' : C.textMuted,
                  background: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  boxShadow: active ? `inset 0 0 0 1px rgba(255, 255, 255, 0.12)` : 'none',
                  transition: 'all 0.2s ease',
                }}>
                <tab.icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* CONTENT */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}
            style={{ paddingBottom: 40 }}>
            {activeTab === 'tasks' && <TaskBoard tasks={tasks} refreshData={refreshData} />}
            {activeTab === 'feed' && <AgentFeed feed={feed} />}
            {activeTab === 'payments' && <PaymentLedger payments={payments} />}
            {activeTab === 'agents' && <AgentProfiles agents={agents} refreshData={refreshData} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  TASK BOARD
// ─────────────────────────────────────────────
const statusColors = { Open: C.primary, Assigned: C.amber, Completed: C.emerald, Disputed: C.red }
const taskMeta = {
  Anomaly: { icon: AlertTriangle, color: C.red },
  Yield: { icon: TrendingUp, color: C.emerald },
  Liquidity: { icon: Droplets, color: C.blue },
  Flash: { icon: Zap, color: C.amber },
  Default: { icon: Search, color: C.primary },
}
function getTaskMeta(title) {
  const key = Object.keys(taskMeta).find(k => k !== 'Default' && title.toLowerCase().includes(k.toLowerCase()))
  return taskMeta[key || 'Default']
}

function TaskBoard({ tasks, refreshData }) {
  const { isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [successCriteria, setSuccessCriteria] = useState('')
  const [bounty, setBounty] = useState('1')
  const [deadlineHours, setDeadlineHours] = useState('24')

  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (isConfirmed) {
      setShowCreateModal(false)
      setTitle('')
      setDescription('')
      setSuccessCriteria('')
      setBounty('1')
      setDeadlineHours('24')
      if (refreshData) refreshData()
    }
  }, [isConfirmed])

  const handleCreateTask = (e) => {
    e.preventDefault()
    if (!isConnected) {
      if (openConnectModal) openConnectModal()
      return
    }
    if (!title || !description || !successCriteria || !bounty || !deadlineHours) return

    const fullDescription = `${title}\n${description}`
    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + parseFloat(deadlineHours) * 3600)
    const bountyWei = parseEther(bounty)

    writeContract({
      address: TASK_REGISTRY,
      abi: TaskRegistryABI,
      functionName: 'createTask',
      args: [fullDescription, successCriteria, bountyWei, deadlineTimestamp],
      value: bountyWei
    })
  }

  const handleClaimTask = (taskId) => {
    if (!isConnected) {
      if (openConnectModal) openConnectModal()
      return
    }
    writeContract({
      address: TASK_REGISTRY,
      abi: TaskRegistryABI,
      functionName: 'assignTask',
      args: [BigInt(taskId)]
    })
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: 'rgba(255, 255, 255, 0.03)',
    color: C.text,
    fontSize: 13,
    outline: 'none',
    transition: 'all 0.2s ease',
  }

  const handleFocus = (e) => {
    e.currentTarget.style.borderColor = C.primary
    e.currentTarget.style.boxShadow = `0 0 10px ${C.primary}25`
  }

  const handleBlur = (e) => {
    e.currentTarget.style.borderColor = C.border
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <ClipboardList size={19} color={C.primary} /> Task Board
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge color={C.textMuted} bg="rgba(255,255,255,0.05)">{tasks.filter(t => t.status === 'Open').length} open</Badge>
          <Button onClick={() => setShowCreateModal(true)} variant="primary">
            <Sparkles size={13} /> Post a Task
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.map((task, i) => {
          const meta = getTaskMeta(task.title)
          const Icon = meta.icon
          const sc = statusColors[task.status] || C.textMuted
          return (
            <motion.div key={task.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  {/* Left part: Icon & Title & Description */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 260 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${meta.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color={meta.color} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: 'Outfit' }}>{task.title}</span>
                        <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace', background: 'rgba(255,255,255,0.03)', padding: '2px 5px', borderRadius: 4 }}>#{task.id}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '480px' }}>{task.description}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textDim }}>
                          <Clock size={11} /> {task.deadline}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right part: Status & Bounty & Claim Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                    <Badge color={sc}>
                      {task.status === 'Assigned' && <Clock size={10} />}
                      {task.status === 'Completed' && <CheckCircle2 size={10} />}
                      {task.status}
                    </Badge>
                    
                    <div style={{ textAlign: 'right', minWidth: 80 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 2 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, background: `linear-gradient(135deg, ${C.primary}, ${C.cyan})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'Outfit' }}>{task.bounty}</span>
                        <span style={{ fontSize: 10, color: C.textDim, fontWeight: 700 }}>MNT</span>
                      </div>
                    </div>

                    <div style={{ minWidth: 90, display: 'flex', justifyContent: 'flex-end' }}>
                      {task.status === 'Open' ? (
                        <Button onClick={() => handleClaimTask(task.id)} variant="primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                          Claim <MoveRight size={11} />
                        </Button>
                      ) : task.status === 'Completed' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: C.emerald }}>
                          <CheckCircle2 size={13} color={C.emerald} /> Paid
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> Running
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
        {tasks.length === 0 && (
          <Card style={{ textAlign: 'center', padding: 48 }}>
            <ClipboardList size={28} color={C.textDim} style={{ margin: '0 auto 10px' }} />
            <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No tasks available yet.</p>
          </Card>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: 500, margin: 'auto' }}>
              <Card style={{ padding: 24, background: '#0a0a0a', border: `1px solid ${C.border}`, boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Sparkles size={16} color={C.primary} /> Post a Task Bounty
                  </h3>
                  <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Task Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} placeholder="e.g. Liquidity Pool Health Monitor" style={inputStyle} required />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} placeholder="Describe what the agent should query or process..." rows={3} style={{ ...inputStyle, resize: 'none' }} required />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Success Criteria (Verifiable Proof Hash Contents)</label>
                    <input type="text" value={successCriteria} onChange={e => setSuccessCriteria(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} placeholder="e.g. proof must contain spread spreads < 1.5% and recommend" style={inputStyle} required />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Bounty (MNT)</label>
                      <input type="number" step="0.01" min="0.01" value={bounty} onChange={e => setBounty(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} style={inputStyle} required />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Deadline (Hours)</label>
                      <input type="number" min="1" value={deadlineHours} onChange={e => setDeadlineHours(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} style={inputStyle} required />
                    </div>
                  </div>

                  {isPending && (
                    <div style={{ padding: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: C.blue, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} style={{ animation: 'spin 2s linear infinite' }} /> Confirming transaction in your wallet...
                    </div>
                  )}

                  {isConfirming && (
                    <div style={{ padding: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, color: C.amber, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} style={{ animation: 'spin 2s linear infinite' }} /> Waiting for transaction confirmation on Mantle...
                    </div>
                  )}

                  {writeError && (
                    <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: C.red, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> {writeError.shortMessage || writeError.message || 'Transaction failed.'}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <Button type="button" onClick={() => setShowCreateModal(false)} variant="secondary" style={{ flex: 1, padding: '10px' }}>Cancel</Button>
                    <Button type="submit" disabled={isPending || isConfirming} variant="primary" style={{ flex: 1, padding: '10px' }}>
                      {(isPending || isConfirming) ? 'Publishing...' : 'Publish Bounty'}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────
//  AGENT FEED
// ─────────────────────────────────────────────
const feedMeta = {
  create: { icon: ClipboardList, color: C.blue },
  claim: { icon: Bot, color: C.primary },
  proof: { icon: CheckCircle2, color: C.emerald },
  payment: { icon: Coins, color: C.amber },
  sync: { icon: Activity, color: C.purple },
  reputation: { icon: TrendingUp, color: C.rose },
}

function AgentFeed({ feed }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Activity size={19} color={C.primary} /> Agent Activity Feed
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GlowDot color={C.emerald} size={7} />
          <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>Live</span>
        </div>
      </div>
      <Card style={{ padding: 0, maxHeight: 520, overflowY: 'auto' }}>
        <AnimatePresence initial={false}>
          {feed.map((ev, i) => {
            const m = feedMeta[ev.type] || { icon: Circle, color: C.textMuted }
            const Icon = m.icon
            return (
              <motion.div key={`${i}-${ev.text.slice(0,15)}`}
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.border}50` }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Icon size={14} color={m.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{ev.text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: C.textDim }}>{ev.time}</span>
                    {ev.tx && (
                      <a href={`${MANTLE_SCAN}/tx/${ev.tx}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 10, color: C.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <ExternalLink size={10} /> View TX
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
//  PAYMENT LEDGER
// ─────────────────────────────────────────────
function PaymentLedger({ payments }) {
  const total = payments.reduce((s, p) => s + p.amount, 0)
  const thStyle = { textAlign: 'left', fontWeight: 600, color: C.textDim, fontSize: 10, padding: '12px 18px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}` }
  const tdStyle = { padding: '14px 18px', borderBottom: `1px solid ${C.border}40`, fontSize: 13 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Wallet size={19} color={C.primary} /> Payment Ledger
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge color={C.textMuted} bg="rgba(255,255,255,0.05)">{payments.length} payments</Badge>
          <Badge color={C.emerald}><Coins size={10} /> {total.toFixed(1)} MNT total</Badge>
        </div>
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Task</th>
                <th style={thStyle}>Agent</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>TX</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <motion.tr key={p.tx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: C.text }}>#{p.taskId}</span>
                    <span style={{ color: C.textMuted, marginLeft: 8 }}>{p.taskName}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.cyan, background: `${C.cyan}0b`, border: `1px solid ${C.cyan}20`, padding: '4px 8px', borderRadius: 6 }}>
                      {p.agent.slice(0,6)}...{p.agent.slice(-4)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, background: `linear-gradient(135deg, ${C.primary}, ${C.cyan})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{p.amount}</span>
                    <span style={{ color: C.textDim, fontSize: 11, marginLeft: 4 }}>MNT</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <Badge color={p.status === 'Completed' ? C.emerald : C.amber}>
                      {p.status === 'Completed' && <CheckCircle2 size={10} />}
                      {p.status}
                    </Badge>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <a href={`${MANTLE_SCAN}/tx/${p.tx}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: C.primary, textDecoration: 'none', fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <ExternalLink size={11} /> {p.tx.slice(0,8)}…
                    </a>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Wallet size={28} color={C.textDim} style={{ margin: '0 auto 10px' }} />
              <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No payments recorded.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
//  AGENT PROFILES
// ─────────────────────────────────────────────
const avatarGradients = [
  'linear-gradient(135deg, #ffffff, #71717a)',
  'linear-gradient(135deg, #e4e4e7, #3f3f46)',
  'linear-gradient(135deg, #a1a1aa, #18181b)',
  'linear-gradient(135deg, #52525b, #27272a)',
  'linear-gradient(135deg, #d4d4d8, #09090b)',
]

function getAgentIcon(name) {
  const lower = name.toLowerCase()
  if (lower.includes('yield')) return Coins
  if (lower.includes('sentinel')) return Shield
  if (lower.includes('liquid') || lower.includes('eye')) return Droplets
  if (lower.includes('arb') || lower.includes('hunter')) return Zap
  if (lower.includes('monitor') || lower.includes('x')) return Cpu
  return Bot
}

function AgentProfiles({ agents, refreshData }) {
  const { isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const [showRegModal, setShowRegModal] = useState(false)
  const [wallet, setWallet] = useState('')
  const [name, setName] = useState('')
  const [metadataURI, setMetadataURI] = useState('ipfs://QmDefault')

  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (isConfirmed) {
      setShowRegModal(false)
      setWallet('')
      setName('')
      setMetadataURI('ipfs://QmDefault')
      if (refreshData) refreshData()
    }
  }, [isConfirmed])

  const handleRegisterAgent = (e) => {
    e.preventDefault()
    if (!isConnected) {
      if (openConnectModal) openConnectModal()
      return
    }
    if (!wallet || !name || !metadataURI) return

    writeContract({
      address: AGENT_REGISTRY,
      abi: AgentRegistryABI,
      functionName: 'registerAgent',
      args: [wallet, name, metadataURI]
    })
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: 'rgba(255, 255, 255, 0.03)',
    color: C.text,
    fontSize: 13,
    outline: 'none',
    transition: 'all 0.2s ease',
  }

  const handleFocus = (e) => {
    e.currentTarget.style.borderColor = C.primary
    e.currentTarget.style.boxShadow = `0 0 10px ${C.primary}25`
  }

  const handleBlur = (e) => {
    e.currentTarget.style.borderColor = C.border
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Bot size={19} color={C.primary} /> Agent Profiles
          <Badge color={C.blue}>ERC-8004</Badge>
        </h2>
        <Button onClick={() => setShowRegModal(true)} variant="primary">
          <Bot size={13} /> Register Agent
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {agents.map((agent, i) => (
          <motion.div key={agent.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card hover>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {(() => {
                    const AgentIcon = getAgentIcon(agent.name)
                    return (
                      <div style={{ width: 46, height: 46, borderRadius: 13, background: avatarGradients[i % avatarGradients.length], display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                        <AgentIcon size={20} color="#fff" />
                      </div>
                    )
                  })()}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {agent.name}
                      {agent.badge && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.amber, background: `${C.amber}15`, padding: '2px 6px', borderRadius: 6, border: `1px solid ${C.amber}25` }}>
                          <Award size={10} color={C.amber} /> Lv.{agent.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.textDim }}>
                      {agent.address.slice(0,6)}...{agent.address.slice(-4)}
                    </div>
                  </div>
                </div>
                <ScoreRing score={agent.score} />
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Tasks', value: agent.tasks, color: C.text },
                  { label: 'Earned', value: `${agent.earned} MNT`, color: C.primary },
                  { label: 'Success', value: `${agent.successRate}%`, color: C.emerald },
                ].map((s, si) => (
                  <div key={si} style={{ padding: '10px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500, marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${C.border}50` }}>
                <Badge color={agent.active ? C.emerald : C.rose}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: agent.active ? C.emerald : C.rose, display: 'inline-block' }} />
                  {agent.active ? 'Active' : 'Idle'}
                </Badge>
                <div style={{ flex: 1 }} />
                <Button 
                  onClick={() => window.open(`${MANTLE_SCAN}/address/${agent.address}`, '_blank')}
                  variant="ghost" 
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500 }}
                >
                  View Profile <ArrowUpRight size={12} />
                </Button>

              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* REGISTER AGENT MODAL */}
      <AnimatePresence>
        {showRegModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: 500, margin: 'auto' }}>
              <Card style={{ padding: 24, background: '#0a0a0a', border: `1px solid ${C.border}`, boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Bot size={16} color={C.primary} /> Register AI Agent
                  </h3>
                  <button onClick={() => setShowRegModal(false)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <form onSubmit={handleRegisterAgent} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Agent Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} placeholder="e.g. YieldOptimus-v1" style={inputStyle} required />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Wallet Address</label>
                    <input type="text" value={wallet} onChange={e => setWallet(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} placeholder="0x..." style={inputStyle} required />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Metadata URI</label>
                    <input type="text" value={metadataURI} onChange={e => setMetadataURI(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} placeholder="ipfs://..." style={inputStyle} required />
                  </div>

                  <p style={{ fontSize: 11, color: C.textDim, margin: '0 0 5px' }}>
                    Note: Agent registration requires OPERATOR_ROLE. The transaction will revert if the connected wallet is not the contract administrator.
                  </p>

                  {isPending && (
                    <div style={{ padding: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: C.blue, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} style={{ animation: 'spin 2s linear infinite' }} /> Confirming transaction in your wallet...
                    </div>
                  )}

                  {isConfirming && (
                    <div style={{ padding: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, color: C.amber, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} style={{ animation: 'spin 2s linear infinite' }} /> Waiting for transaction confirmation on Mantle...
                    </div>
                  )}

                  {writeError && (
                    <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: C.red, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> {writeError.shortMessage || writeError.message || 'Transaction failed.'}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <Button type="button" onClick={() => setShowRegModal(false)} variant="secondary" style={{ flex: 1, padding: '10px' }}>Cancel</Button>
                    <Button type="submit" disabled={isPending || isConfirming} variant="primary" style={{ flex: 1, padding: '10px' }}>
                      {(isPending || isConfirming) ? 'Registering...' : 'Register Agent'}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────
//  APP
// ─────────────────────────────────────────────
export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Dashboard />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
