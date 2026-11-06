import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

export default function OutgoingChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
        <CartesianGrid stroke="#eef0f6" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#9296ab' }}
          axisLine={{ stroke: '#eef0f6' }}
          tickLine={false}
          label={{ value: 'Dates', position: 'insideBottom', offset: -14, fill: '#333849', fontSize: 13, fontWeight: 600 }}
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fontSize: 12, fill: '#9296ab' }}
          axisLine={{ stroke: '#eef0f6' }}
          tickLine={false}
          label={{ value: 'Total Outgoing Messages', angle: -90, position: 'insideLeft', fill: '#333849', fontSize: 12, fontWeight: 600 }}
        />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#5b57e0" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
