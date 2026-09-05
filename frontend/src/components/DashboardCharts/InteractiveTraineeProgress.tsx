import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Cell } from 'recharts';

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
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>Ready to start training?</h3>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>You haven't assigned any Learning Paths or Tasks to trainees yet.</p>
        <button 
          onClick={() => window.location.href = '/learning-paths'}
          className="hover-effect active-effect touch-target"
          style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
          Assign Learning Path
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
          <option value="On Track">On Track</option>
          <option value="At Risk">At Risk</option>
        </select>
      </div>

      <div style={{ height: '350px', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ minWidth: `${Math.max(100, filteredData.length * 75)}px`, height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }} onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload.length > 0) {
                const traineeId = e.activePayload[0].payload.traineeId;
                if (traineeId) window.location.href = `/trainer/trainees/${traineeId}`;
              }
            }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="traineeName" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} style={{ cursor: 'pointer' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                cursor={{ fill: '#f8fafc', cursor: 'pointer' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
              <Bar className="hover-effect" dataKey="progressPercent" name="Progress %" fill="#4f46e5" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer', transition: 'all 0.2s' }} />
              <Bar className="hover-effect" dataKey="avgScore" name="Avg Score" fill="#10b981" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                {filteredData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.status === 'At Risk' ? '#ef4444' : '#10b981'} style={{ cursor: 'pointer' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
