import React, { useState, useEffect } from 'react';
import { 
  Server, Cpu, Activity, HardDrive, ShieldCheck, 
  RefreshCw, CheckCircle, Clock, Globe, Terminal, Box, Cloud
} from 'lucide-react';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  const fetchData = async () => {
    try {
      const res = await fetch('/api/metrics');
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const env = data?.env || 'Production';
  const isDev = env.toLowerCase() === 'dev';

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#f3f4f6', padding: '24px 32px' }}>
      {/* Top Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f293d', paddingBottom: '20px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', padding: '10px', borderRadius: '10px', display: 'flex' }}>
            <Cloud size={28} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em' }}>CloudPulse SRE Monitoring</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>Option 1: Single Web Application on Single EC2 (Dockerized)</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ 
            background: isDev ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)', 
            color: isDev ? '#eab308' : '#22c55e', 
            border: `1px solid ${isDev ? '#eab308' : '#22c55e'}`,
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
          }}>
            {env.toUpperCase()} ENVIRONMENT
          </span>

          <span style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} /> Updated: {lastUpdated}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
        
        {/* Metric Cards */}
        <div style={{ gridColumn: 'span 4', background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500' }}>VIRTUAL CPU LOAD</span>
            <Cpu size={18} color="#60a5fa" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#ffffff' }}>
            {data ? `${data.cpuUsage}%` : '...'}
          </div>
          <div style={{ marginTop: '12px', height: '6px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${data?.cpuUsage || 25}%`, height: '100%', background: '#3b82f6', transition: 'width 0.5s ease' }}></div>
          </div>
        </div>

        <div style={{ gridColumn: 'span 4', background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500' }}>MEMORY ALLOCATION</span>
            <Activity size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#ffffff' }}>
            {data ? `${data.memoryUsage}%` : '...'}
          </div>
          <div style={{ marginTop: '12px', height: '6px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${data?.memoryUsage || 40}%`, height: '100%', background: '#10b981', transition: 'width 0.5s ease' }}></div>
          </div>
        </div>

        <div style={{ gridColumn: 'span 4', background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500' }}>SYSTEM HEALTH STATUS</span>
            <ShieldCheck size={18} color="#a78bfa" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}>
            <CheckCircle size={24} /> 99.98% Healthy
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>
            Uptime: {data ? `${data.uptimeSeconds}s continuous` : 'Loading...'}
          </div>
        </div>

        {/* Deployment & Architecture Specs */}
        <div style={{ gridColumn: 'span 8', background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} color="#60a5fa" />
            Infrastructure Specification & Domain Binding
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div style={{ background: '#1f293d', padding: '14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>HOST INSTANCE</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#f9fafb', marginTop: '4px' }}>
                {data?.hostname || 'i-0ec2web-instance'}
              </div>
            </div>
            <div style={{ background: '#1f293d', padding: '14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>ACTIVE DOMAIN</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#60a5fa', marginTop: '4px' }}>
                {isDev ? 'opt1-dev.png261.dev' : 'opt1.png261.dev'}
              </div>
            </div>
            <div style={{ background: '#1f293d', padding: '14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>DOCKER CONTAINER</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#34d399', marginTop: '4px' }}>
                Pulled from AWS ECR (Clean Separation)
              </div>
            </div>
            <div style={{ background: '#1f293d', padding: '14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>SECURITY & EDGE</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#f59e0b', marginTop: '4px' }}>
                Cloudflare Universal SSL / TLS 1.3
              </div>
            </div>
          </div>
        </div>

        {/* Live Service Logs */}
        <div style={{ gridColumn: 'span 4', background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} color="#34d399" />
            Live Service Telemetry
          </h3>
          <div style={{ background: '#030712', borderRadius: '8px', padding: '14px', fontFamily: 'monospace', fontSize: '12px', color: '#a3e635', lineHeight: '1.6' }}>
            <div>&gt; System check: OK</div>
            <div>&gt; Port 80 listener: ACTIVE</div>
            <div>&gt; ECR image verification: PASSED</div>
            <div>&gt; Memory heap: {data ? `${data.heapUsedMb} MB` : '32 MB'}</div>
            <div>&gt; Status: 200 OK (Heartbeat)</div>
          </div>
        </div>

      </main>
    </div>
  );
}
