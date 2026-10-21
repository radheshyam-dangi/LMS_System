import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

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
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ width: '190px', height: '18px', background: '#f1f5f9', borderRadius: '4px', animation: 'progressSkeletonPulse 1.5s infinite ease-in-out' }} />
          <div style={{ width: '110px', height: '28px', background: '#f1f5f9', borderRadius: '6px', animation: 'progressSkeletonPulse 1.5s infinite ease-in-out' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '160px', padding: '8px 16px', gap: '16px', borderBottom: '1px solid #f1f5f9' }}>
          {[55, 80, 45, 90, 65, 75].map((h, i) => (
            <div key={i} style={{ width: '36px', height: `${h}%`, background: '#f1f5f9', borderRadius: '4px 4px 0 0', animation: 'progressSkeletonPulse 1.5s infinite ease-in-out' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: '70px', height: '12px', background: '#f1f5f9', borderRadius: '3px', animation: 'progressSkeletonPulse 1.5s infinite ease-in-out' }} />
          ))}
        </div>
        <style>{`
          @keyframes progressSkeletonPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
          }
        `}</style>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '28px 20px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px 0', color: '#0f172a' }}>Trainee Progress Overview</h3>
        <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No active trainee enrollments found for your learning paths.</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#0f172a' }}>Trainee Progress Overview</h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Real-time learning progress for assigned trainees</span>
        </div>
        <select 
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', background: '#fff', outline: 'none', cursor: 'default' }}
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
          pointer-events: none;
        }
      `}</style>

      <div 
        className="trainee-progress-chart-container" 
        style={{ height: '200px', width: '100%', overflowX: 'auto', overflowY: 'hidden', outline: 'none', userSelect: 'none', cursor: 'default' }}
      >
        {filteredData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '13px' }}>
            No trainees match the selected filter.
          </div>
        ) : (
          <div style={{ minWidth: `${Math.max(100, filteredData.length * 70)}px`, height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={filteredData} 
                margin={{ top: 8, right: 10, left: -20, bottom: 8 }}
                style={{ outline: 'none' }}
                tabIndex={-1}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="traineeName" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '12px', padding: '6px 10px' }}
                  cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                  formatter={(value: any, name: any, props: any) => {
                    if (name === 'Progress %') return [`${value}% (${props.payload.status})`, name];
                    return [`${value}%`, name];
                  }}
                />
                <Bar 
                  dataKey="progressPercent" 
                  name="Progress %" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={48}
                  minPointSize={3}
                  isAnimationActive={false}
                >
                  {filteredData.map((entry, index) => {
                    let color = '#4f46e5';
                    if (entry.status === 'Completed') color = '#10b981';
                    else if (entry.status === 'On Track') color = '#3b82f6';
                    else if (entry.status === 'At Risk') color = '#ef4444';
                    else if (entry.status === 'Not Started') color = '#94a3b8';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', fontSize: '11px', color: '#64748b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }}/> Completed</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '2px' }}/> On Track</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }}/> At Risk</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#94a3b8', borderRadius: '2px' }}/> Not Started</div>
      </div>
    </div>
  );
};
