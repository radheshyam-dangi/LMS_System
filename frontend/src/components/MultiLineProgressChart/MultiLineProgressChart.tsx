import React from 'react';
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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

export const MultiLineProgressChart: React.FC<MultiLineProgressChartProps> = ({ title, subtitle, xAxisKey = "name", data, series, height = 500, emptyMessage, tooltipLabelFormatter, tooltipFormatter }) => {
  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>{subtitle}</p>}
      <div style={{ width: '100%', height: height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 150 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} angle={-45} textAnchor="end" />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(val) => `${val}%`} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              itemStyle={{ fontSize: '13px', fontWeight: 600 }}
              labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}
              labelFormatter={tooltipLabelFormatter}
              formatter={tooltipFormatter}
            />
            {series.map((s, idx) => {
              if (s.type === 'bar') {
                return <Bar key={idx} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={60} />;
              }
              if (s.type === 'area') {
                return <Area key={idx} type="monotone" dataKey={s.key} name={s.name} fill={s.color} stroke={s.color} strokeWidth={3} fillOpacity={0.2} activeDot={{ r: 5, strokeWidth: 0 }} />;
              }
              return (
                <Line 
                  key={idx} 
                  type="monotone" 
                  dataKey={s.key} 
                  name={s.name} 
                  stroke={s.color} 
                  strokeWidth={3} 
                  dot={false} 
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
