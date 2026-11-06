import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
      }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>{label}</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '15px', color: '#2563EB', fontWeight: 800 }}>
          {payload[0].value} Outgoing Messages
        </p>
      </div>
    )
  }
  return null
}

export default function OutgoingChart({ data }) {
  if (!data || data.length === 0) {
    data = [
      { date: 'Mon', count: 4 },
      { date: 'Tue', count: 7 },
      { date: 'Wed', count: 5 },
      { date: 'Thu', count: 9 },
      { date: 'Fri', count: 6 },
      { date: 'Sat', count: 8 },
      { date: 'Sun', count: 12 },
    ]
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="outgoingGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#F1F5F9" vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
          dy={8}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          dx={-8}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#2563EB"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#outgoingGradient)"
          dot={{ r: 4, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
          activeDot={{ r: 7, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
