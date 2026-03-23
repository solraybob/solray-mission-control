'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  url: string;
  status: 'up' | 'down';
  statusCode: number;
  ms: number;
}

interface DashboardData {
  users: { total: number; new_7d: number };
  waitlist: { total: number; new_7d: number };
  backend_version: string;
  timestamp: string;
}

interface Tweet {
  id: string;
  text: string;
  timestamp: string;
}

interface EmailStats {
  total_in_queue: number;
  pending_day3: number;
  pending_day7: number;
  last_email_sent: string | null;
  updated_at?: string;
}

interface DnsStatus {
  domain: string;
  nameservers: string[];
  aRecords: string[];
  propagated: boolean;
  status: string;
}

interface MemoryData {
  entries: string[];
  date: string | null;
  file?: string;
}

interface CronJob {
  name: string;
  schedule: string;
  label: string;
  tz: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextCronFire(cronExpr: string, tz: string): string {
  const parts = cronExpr.split(' ');
  if (parts.length < 5) return 'Unknown';
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);

  const now = new Date();
  const madridNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  const target = new Date(madridNow);
  target.setHours(hour, minute, 0, 0);

  if (target <= madridNow) {
    target.setDate(target.getDate() + 1);
  }

  const diffMs = target.getTime() - madridNow.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  if (diffH < 24) {
    return `in ${diffH}h ${diffM}m (${hh}:${mm})`;
  } else {
    return `Tomorrow ${hh}:${mm}`;
  }
}

function formatTs(ts: string): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8d5b8',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 12px rgba(232, 130, 26, 0.08), 0 1px 4px rgba(26, 16, 8, 0.06)',
    }}>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '1.4rem',
        color: '#e8821a',
        margin: '0 0 16px',
        fontWeight: 600,
      }}>
        {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: 'up' | 'down' | 'loading' }) {
  const color = status === 'up' ? '#22c55e' : status === 'down' ? '#ef4444' : '#c8b89a';
  return (
    <span style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: color,
      boxShadow: status === 'up' ? '0 0 6px rgba(34, 197, 94, 0.5)' : undefined,
      marginRight: 8,
      flexShrink: 0,
    }} />
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.75rem', color: '#7a6a5a', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontFamily: "'Cormorant Garamond', serif", color: '#1a1008', fontWeight: 600 }}>
        {value}
        {sub && <span style={{ fontSize: '0.8rem', color: '#7a6a5a', marginLeft: 6 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── PM Office ───────────────────────────────────────────────────────────────

type PMStatus = 'active' | 'ready' | 'partial' | 'not-started';

interface PM {
  id: string;
  name: string;
  project: string;
  avatar: string;
  timeOfDay: string;
  status: PMStatus;
  task: string;
}

const PM_ROSTER: PM[] = [
  { id: 'solray',   name: 'PM Solray',   project: 'Solray AI',    avatar: '🌙', timeOfDay: 'Midnight',    status: 'active',      task: 'Awaiting Lemon Squeezy approval. Backend + frontend live.' },
  { id: 'bobby',    name: 'PM Bobby',    project: 'Agent Bobby',  avatar: '☀️', timeOfDay: 'High Noon',   status: 'not-started', task: 'Awaiting Solray AI launch before building.' },
  { id: 'canon',    name: 'PM Canon',    project: 'Solar Canon',  avatar: '📚', timeOfDay: 'Dawn',        status: 'ready',       task: '14 books written. Need sales infrastructure.' },
  { id: 'dog',      name: 'PM Dog',      project: 'Sol-Ray Dog',  avatar: '🐕', timeOfDay: 'Golden Hour', status: 'not-started', task: 'Needs audience first. Build after content grows.' },
  { id: 'commerce', name: 'PM Commerce', project: 'Commerce',     avatar: '🛍', timeOfDay: 'Full Sun',    status: 'not-started', task: 'Physical products last. Needs volume.' },
  { id: 'content',  name: 'PM Content',  project: 'Content',      avatar: '🌅', timeOfDay: 'Sunrise',     status: 'partial',     task: 'X automated 3x/day. Other channels pending.' },
];

function pmStatusColor(status: PMStatus): string {
  return status === 'active' ? '#e8821a'
    : status === 'partial' ? '#c9681a'
    : status === 'ready' ? '#60a5fa'
    : '#c8b89a';
}

function pmBorderColor(status: PMStatus): string {
  return status === 'active' ? '#e8821a'
    : status === 'partial' ? '#c9681a88'
    : status === 'ready' ? '#60a5fa55'
    : '#e8d5b8';
}

function pmShadow(status: PMStatus): string {
  return status === 'active'
    ? '0 4px 20px rgba(232, 130, 26, 0.2), 0 2px 8px rgba(232, 130, 26, 0.12)'
    : status === 'partial'
    ? '0 4px 16px rgba(201, 104, 26, 0.12)'
    : '0 2px 8px rgba(26, 16, 8, 0.06)';
}

function pmStatusLabel(status: PMStatus): string {
  return status === 'active' ? 'Active'
    : status === 'partial' ? 'Partial'
    : status === 'ready' ? 'Ready'
    : 'Not Started';
}

function PMOfficeSection() {
  return (
    <div style={{ padding: '0 32px 8px' }}>
      <style>{`
        @keyframes pmPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(232, 130, 26, 0.2), 0 2px 8px rgba(232, 130, 26, 0.12); }
          50% { box-shadow: 0 6px 28px rgba(232, 130, 26, 0.35), 0 3px 12px rgba(232, 130, 26, 0.2); }
        }
        @keyframes pmPulsePartial {
          0%, 100% { box-shadow: 0 4px 16px rgba(201, 104, 26, 0.12); }
          50% { box-shadow: 0 6px 22px rgba(201, 104, 26, 0.22); }
        }
        .pm-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .pm-card:hover { transform: translateY(-4px) !important; }
        .pm-card-active { animation: pmPulse 3s ease-in-out infinite; }
        .pm-card-partial { animation: pmPulsePartial 3s ease-in-out infinite; }
      `}</style>

      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '1.8rem',
        color: '#1a1008',
        margin: '0 0 16px',
        fontWeight: 600,
      }}>
        🏢 PM Office
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {PM_ROSTER.map(pm => {
          const animClass = pm.status === 'active' ? 'pm-card pm-card-active'
            : pm.status === 'partial' ? 'pm-card pm-card-partial'
            : 'pm-card';
          return (
            <div
              key={pm.id}
              className={animClass}
              style={{
                background: pm.status === 'active' ? '#fffbf5' : '#ffffff',
                border: `1px solid ${pmBorderColor(pm.status)}`,
                borderLeft: pm.status === 'active' ? `3px solid #e8821a` : `1px solid ${pmBorderColor(pm.status)}`,
                borderRadius: 12,
                padding: '18px 20px',
                boxShadow: pmShadow(pm.status),
                cursor: 'default',
              }}
            >
              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '2rem', lineHeight: 1 }}>{pm.avatar}</span>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.72rem',
                  padding: '3px 9px',
                  borderRadius: 20,
                  background: pm.status === 'active' ? 'rgba(232, 130, 26, 0.12)'
                    : pm.status === 'partial' ? 'rgba(201, 104, 26, 0.1)'
                    : pm.status === 'ready' ? 'rgba(96, 165, 250, 0.1)'
                    : 'rgba(200, 184, 154, 0.2)',
                  border: `1px solid ${pmStatusColor(pm.status)}44`,
                  color: pmStatusColor(pm.status),
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: pmStatusColor(pm.status),
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  {pmStatusLabel(pm.status)}
                </span>
              </div>

              {/* Names */}
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#1a1008',
                marginBottom: 2,
              }}>
                {pm.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#e8821a', marginBottom: 6, fontWeight: 500 }}>
                {pm.project}
              </div>

              {/* Time of day */}
              <div style={{ fontSize: '0.72rem', color: '#7a6a5a', marginBottom: 10 }}>
                🕐 {pm.timeOfDay}
              </div>

              {/* Task */}
              <div style={{
                fontSize: '0.8rem',
                color: '#7a6a5a',
                lineHeight: 1.4,
                borderTop: '1px solid #e8d5b8',
                paddingTop: 10,
              }}>
                {pm.task}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cron Jobs ────────────────────────────────────────────────────────────────

const CRON_JOBS: CronJob[] = [
  { name: 'X Morning Post', schedule: '0 8 * * *', label: '☀️', tz: 'Europe/Madrid' },
  { name: 'X Afternoon Post', schedule: '0 13 * * *', label: '🌤', tz: 'Europe/Madrid' },
  { name: 'X Evening Post', schedule: '0 19 * * *', label: '🌙', tz: 'Europe/Madrid' },
  { name: 'Nightly Memory Consolidation', schedule: '0 2 * * *', label: '🧠', tz: 'Europe/Madrid' },
  { name: 'Email Follow-up', schedule: '0 9 * * *', label: '📧', tz: 'Europe/Madrid' },
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function MissionControl() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [health, setHealth] = useState<ServiceStatus[] | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tweets, setTweets] = useState<Tweet[] | null>(null);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [dns, setDns] = useState<DnsStatus | null>(null);
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [h, d, t, e, dnsData, m] = await Promise.allSettled([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/tweets').then(r => r.json()),
        fetch('/api/email-stats').then(r => r.json()),
        fetch('/api/dns').then(r => r.json()),
        fetch('/api/memory').then(r => r.json()),
      ]);

      if (h.status === 'fulfilled') setHealth(h.value);
      if (d.status === 'fulfilled') setDashboard(d.value);
      if (t.status === 'fulfilled') setTweets(Array.isArray(t.value) ? t.value : []);
      if (e.status === 'fulfilled') setEmailStats(e.value);
      if (dnsData.status === 'fulfilled') setDns(dnsData.value);
      if (m.status === 'fulfilled') setMemory(m.value);

      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf6f0',
      color: '#1a1008',
      fontFamily: "'Inter', sans-serif",
      padding: '0 0 60px',
    }}>

      {/* Header — newspaper masthead style */}
      <div style={{
        background: 'linear-gradient(135deg, #e8821a 0%, #c9681a 50%, #b5561a 100%)',
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 4px 20px rgba(232, 130, 26, 0.3)',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            color: '#1a1008',
            margin: 0,
            lineHeight: 1,
            letterSpacing: '-0.5px',
          }}>
            ☀ Mission Control
          </h1>
          <div style={{
            fontSize: '0.85rem',
            color: 'rgba(26, 16, 8, 0.7)',
            marginTop: 6,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}>
            Sol-Ray Bob Empire · Operations Command
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {lastUpdated && (
            <div style={{ fontSize: '0.8rem', color: 'rgba(26, 16, 8, 0.65)' }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '6px 16px',
              background: 'rgba(26, 16, 8, 0.15)',
              border: '1px solid rgba(26, 16, 8, 0.3)',
              borderRadius: 6,
              color: '#1a1008',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: '0.8rem',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
            }}
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Thin gold rule below header */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, #c9681a, #e8821a, #c9681a)',
      }} />

      {/* PM Office */}
      <div style={{ padding: '28px 0 8px', background: '#fff8f0' }}>
        <PMOfficeSection />
      </div>

      {/* Grid */}
      <div style={{
        padding: '24px 32px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 20,
        background: '#fffdf8',
      }}>

        {/* 1. System Health */}
        <Card title="System Health" icon="🔴">
          {!health ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Checking services...</div>
          ) : (
            <div>
              {health.map(svc => (
                <div key={svc.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #e8d5b8',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StatusDot status={svc.status as 'up' | 'down'} />
                    <span style={{ fontSize: '0.9rem', color: '#1a1008' }}>{svc.name}</span>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: svc.status === 'up' ? '#22c55e' : '#ef4444',
                  }}>
                    {svc.status === 'up' ? `${svc.ms}ms` : `HTTP ${svc.statusCode || 'err'}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 2. Users & Growth */}
        <Card title="Users & Growth" icon="📈">
          {!dashboard ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <Stat label="Total Users" value={dashboard.users?.total ?? 0} />
              <Stat label="New (7d)" value={dashboard.users?.new_7d ?? 0} />
              <Stat label="Waitlist" value={dashboard.waitlist?.total ?? 0} />
              <Stat label="New Waitlist (7d)" value={dashboard.waitlist?.new_7d ?? 0} />
            </div>
          )}
        </Card>

        {/* 3. X / Twitter Posts */}
        <Card title="Recent X Posts" icon="✖">
          {!tweets ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Loading...</div>
          ) : tweets.length === 0 ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>No recent posts found.</div>
          ) : (
            <div>
              {tweets.slice(0, 5).map((tweet, i) => (
                <div key={tweet.id || i} style={{
                  padding: '8px 0',
                  borderBottom: i < tweets.length - 1 ? '1px solid #e8d5b8' : 'none',
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#7a6a5a', marginBottom: 3 }}>
                    {formatTs(tweet.timestamp)}
                    {tweet.id && (
                      <a
                        href={`https://twitter.com/solraybob/status/${tweet.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#e8821a', marginLeft: 8, textDecoration: 'none' }}
                      >
                        ↗
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.4, color: '#1a1008' }}>
                    {tweet.text.length > 140 ? tweet.text.slice(0, 140) + '…' : tweet.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 4. Email Queue */}
        <Card title="Email Queue" icon="📧">
          {!emailStats ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <Stat label="Total in Queue" value={emailStats.total_in_queue} />
              <Stat label="Pending Day-3" value={emailStats.pending_day3} />
              <Stat label="Pending Day-7" value={emailStats.pending_day7} />
              <div>
                <div style={{ fontSize: '0.75rem', color: '#7a6a5a', marginBottom: 2 }}>Last Sent</div>
                <div style={{ fontSize: '0.85rem', color: '#1a1008' }}>
                  {emailStats.last_email_sent ? formatTs(emailStats.last_email_sent) : 'None yet'}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 5. DNS Status */}
        <Card title="DNS Status" icon="🌐">
          {!dns ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Checking DNS...</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <StatusDot status={dns.propagated ? 'up' : 'down'} />
                <span style={{ fontWeight: 600, marginRight: 8, color: '#1a1008' }}>solray.ai</span>
                <span style={{
                  padding: '2px 10px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  background: dns.propagated ? '#22c55e18' : '#ef444418',
                  color: dns.propagated ? '#22c55e' : '#ef4444',
                  border: `1px solid ${dns.propagated ? '#22c55e44' : '#ef444444'}`,
                }}>
                  {dns.status}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#7a6a5a', marginBottom: 4 }}>Nameservers</div>
              {dns.nameservers.slice(0, 4).map(ns => (
                <div key={ns} style={{ fontSize: '0.8rem', color: '#1a1008', marginBottom: 2 }}>
                  → {ns}
                </div>
              ))}
              {dns.aRecords.length > 0 && (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#7a6a5a', marginTop: 8, marginBottom: 4 }}>A Records</div>
                  {dns.aRecords.map(ip => (
                    <div key={ip} style={{ fontSize: '0.8rem', color: '#1a1008', marginBottom: 2 }}>
                      → {ip}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Card>

        {/* 6. Cron Jobs */}
        <Card title="Cron Jobs" icon="⏱">
          <div>
            {CRON_JOBS.map(job => (
              <div key={job.name} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #e8d5b8',
              }}>
                <div style={{ fontSize: '0.85rem', color: '#1a1008' }}>
                  <span style={{ marginRight: 6 }}>{job.label}</span>
                  {job.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#7a6a5a', textAlign: 'right' }}>
                  {nextCronFire(job.schedule, job.tz)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 7. Recent Memory */}
        <Card title="Recent Memory" icon="🧠">
          {!memory ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <div>
              {memory.date && (
                <div style={{ fontSize: '0.75rem', color: '#7a6a5a', marginBottom: 10 }}>
                  From {memory.date}
                </div>
              )}
              {memory.entries.length === 0 ? (
                <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>No memory entries found.</div>
              ) : (
                <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                  {memory.entries.map((entry, i) => (
                    <li key={i} style={{
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      marginBottom: 8,
                      color: '#1a1008',
                    }}>
                      {entry}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '0 32px',
        color: '#7a6a5a',
        fontSize: '0.75rem',
        background: '#fffdf8',
      }}>
        Auto-refreshes every 60s · Sol-Ray Bob Empire · Mission Control
      </div>
    </div>
  );
}
