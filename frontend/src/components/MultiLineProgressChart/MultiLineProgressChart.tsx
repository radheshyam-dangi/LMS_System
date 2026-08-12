import React from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export type SeriesConfig = {
  key: string;
  name: string;
  color: string;
  type?: 'line' | 'area' | 'bar';
};

type MultiLineProgressChartProps = {
  title: string;
  subtitle?: string;
  xAxisKey?: string;
  data: any[];
  series: SeriesConfig[];
  height?: number;
  emptyMessage?: string;
  tooltipLabelFormatter?: (label: any) => any;
  tooltipFormatter?: (value: any, name: any, props: any) => any[];
};

export const MultiLineProgressChart: React.FC<MultiLineProgressChartProps> = ({ title, subtitle, xAxisKey = "name", data, series, height = 300, emptyMessage, tooltipLabelFormatter, tooltipFormatter }) => {
  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>{subtitle}</p>}
      <div style={{ width: '100%', height: height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              itemStyle={{ fontSize: '13px', fontWeight: 600 }}
              labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}
              labelFormatter={tooltipLabelFormatter}
              formatter={tooltipFormatter}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            {series.map((s, idx) => {
              if (s.type === 'line') {
                 return <Line key={idx} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={3} dot={false} />;
              }
              return (
                 <Area key={idx} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.1} strokeWidth={2} />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
