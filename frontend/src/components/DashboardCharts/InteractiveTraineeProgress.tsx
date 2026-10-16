import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import { Compass } from 'lucide-react';

type TraineeProgress = {
  traineeId: string;
  traineeName: string;
  assignedLps: string;
  detailedLps?: { title: string; progress: number; score: number | null; status: string }[];
  progressPercent: number;
  avgScore: number | null;
  status: string;
};

type InteractiveTraineeProgressProps = {
  data: TraineeProgress[];
  isLoading: boolean;
  accessToken?: string;
};

export const InteractiveTraineeProgress: React.FC<InteractiveTraineeProgressProps> = ({ data, isLoading }) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const filteredData = useMemo(() => {
    return data.filter(d => filterStatus === 'All' || d.status === filterStatus);
  }, [data, filterStatus]);

  if (isLoading) {
    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '24px', minHeight: '400px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>Trainee Progress Overview</h3>
        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: '32px', background: '#f1f5f9', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Compass size={24} strokeWidth={1.75} />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a' }}>Cohort Progress Overview</h3>
        <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '20px' }}>No active trainee enrollments found for current curriculum tracks.</p>
        <button 
          onClick={() => window.location.href = '/learning-paths'}
          className="hover-effect active-effect touch-target"
          style={{ padding: '8px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          Manage Learning Paths
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Trainee Progress Overview</h3>
        <select 
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="hover-effect touch-target"
          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', background: '#fff', outline: 'none', cursor: 'pointer' }}
        >
          <option value="All">All Statuses</option>
          <option value="Not Started">Not Started</option>
          <option value="On Track">On Track</option>
          <option value="At Risk">At Risk</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      <style>{`
        .trainee-progress-chart-container,
        .trainee-progress-chart-container svg,
        .trainee-progress-chart-container .recharts-wrapper,
        .trainee-progress-chart-container .recharts-surface,
        .trainee-progress-chart-container .recharts-layer,
        .trainee-progress-chart-container .recharts-bar,
        .trainee-progress-chart-container .recharts-bar-rectangles,
        .trainee-progress-chart-container .recharts-bar-rectangle,
        .trainee-progress-chart-container *:focus,
        .trainee-progress-chart-container *:focus-visible {
          outline: none !important;
          box-shadow: none !important;
          -webkit-tap-highlight-color: transparent;
        }
        .trainee-progress-chart-container .recharts-bar-rectangle {
          cursor: default !important;
        }
      `}</style>

      <div 
        className="trainee-progress-chart-container" 
        style={{ height: '350px', width: '100%', overflowX: 'auto', overflowY: 'hidden', outline: 'none', userSelect: 'none' }}
        onMouseDown={e => {
          if ((e.target as HTMLElement)?.tagName !== 'SELECT') {
            e.preventDefault();
          }
        }}
      >
        {filteredData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
            No trainees match the selected filter.
          </div>
        ) : (
          <div style={{ minWidth: `${Math.max(100, filteredData.length * 75)}px`, height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={filteredData} 
              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              style={{ outline: 'none' }}
              tabIndex={-1}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="traineeName" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                formatter={(value: any, name: any, props: any) => {
                  if (name === 'Progress %') return [`${value}% (${props.payload.status})`, name];
                  return [`${value}%`, name];
                }}
              />
              <Bar 
                dataKey="progressPercent" 
                name="Progress %" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={60}
                style={{ transition: 'all 0.2s' }} 
                minPointSize={3}
              >
                {filteredData.map((entry, index) => {
                  let color = '#4f46e5'; // default
                  if (entry.status === 'Completed') color = '#10b981';
                  else if (entry.status === 'On Track') color = '#3b82f6';
                  else if (entry.status === 'At Risk') color = '#ef4444';
                  else if (entry.status === 'Not Started') color = '#94a3b8';
                  return <Cell 
                           key={`cell-${index}`} 
                           fill={color} 
                         />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', fontSize: '12px', color: '#64748b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}/> Completed</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '2px' }}/> On Track</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }}/> At Risk</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#94a3b8', borderRadius: '2px' }}/> Not Started</div>
      </div>
    </div>
  );
};
