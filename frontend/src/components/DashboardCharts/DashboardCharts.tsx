import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { API_BASE_URL } from '../../api';
import axios from 'axios';

type ChartData = {
  date: string;
  name?: string;
  submissions?: number;
  completions?: number;
  score?: number;
  [key: string]: any;
};

type DashboardChartsProps = {
  title: string;
  subtitle: string;
  role: string;
  type: 'progress' | 'score';
  accessToken: string;
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ title, subtitle, role, type, accessToken }) => {
  const [dayRange, setDayRange] = useState<number>(() => {
    const saved = localStorage.getItem(`dashboardChartRange_${type}`);
    return saved ? parseInt(saved, 10) : 30;
  });
  
  const [data, setData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem(`dashboardChartRange_${type}`, dayRange.toString());
  }, [dayRange, type]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    
    const endpoint = type === 'progress' ? 'progress-trends' : 'evaluation-score';
    
    axios.get(`${API_BASE_URL}/dashboard/${endpoint}?range=${dayRange}&role=${role}`, {
      headers: {
        'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        'Content-Type': 'application/json',
      },
      withCredentials: true
    })
      .then(response => {
        if (!cancelled) {
          const json = response.data;
          const parsedData = Array.isArray(json) ? json : (json.data || []);
          setData(parsedData);
          setIsLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to fetch dashboard chart data:", err);
        if (!cancelled) setIsLoading(false);
      });
      
    return () => { cancelled = true; };
  }, [dayRange, role, type, accessToken]);

  const isEmpty = data.length === 0 || data.every(d => 
    (type === 'progress' ? (d.submissions === 0 && d.completions === 0) : d.score === 0)
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#fff', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{label}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
              {p.name}: {p.value}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const chartData = data;

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>{title}</h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: '#f8fafc', padding: '4px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          {[30, 50, 90, 120, 140, 365].map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDayRange(range)}
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: dayRange === range ? '#4f46e5' : 'transparent',
                color: dayRange === range ? '#fff' : '#64748b',
                transition: 'all 0.2s',
              }}
            >
              {range}D
            </button>
          ))}
        </div>
      </div>
      
      {/* Metric Callout */}
      {type === 'progress' && data.length > 0 && (
        <div style={{ marginBottom: '16px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
          Completion rate <span style={{ color: '#0f172a', fontWeight: 800 }}>{Math.round((data.reduce((sum, d) => sum + (d.completions || 0), 0) / Math.max(1, data.reduce((sum, d) => sum + (d.submissions || 0), 0))) * 100)}%</span>
        </div>
      )}
      {type === 'score' && data.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
            {Math.round(data.reduce((sum, d) => sum + (d.score || 0), 0) / Math.max(1, data.filter(d => d.score !== null && d.score !== undefined).length))}
          </span>
          <span style={{ fontSize: '13px', color: '#64748b' }}>/100</span>
        </div>
      )}

      <div style={{ width: '100%', height: '300px', position: 'relative' }}>
        {isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 10 }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Loading...</span>
          </div>
        )}

        <ResponsiveContainer>
          {type === 'progress' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCompletions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} minTickGap={20} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              <Area type="monotone" isAnimationActive={true} animationDuration={500} dataKey="submissions" name="Submissions" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSubmissions)" />
              <Area type="monotone" isAnimationActive={true} animationDuration={500} dataKey="completions" name="Completions" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCompletions)" />
            </AreaChart>
          ) : (
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScoreGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} minTickGap={20} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              <Area connectNulls={true} type="monotone" isAnimationActive={true} animationDuration={500} dataKey="score" name="Avg Score" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorScoreGreen)" dot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Line type="monotone" isAnimationActive={true} animationDuration={500} dataKey="target" name="Target Baseline" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
