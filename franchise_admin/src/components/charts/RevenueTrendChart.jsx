import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

function RevenueTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(94, 109, 137, 0.25)" />
        <XAxis dataKey="day" tick={{ fill: '#5e6d89' }} />
        <YAxis yAxisId="left" tick={{ fill: '#5e6d89' }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#5e6d89' }} />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #d7e0f2'
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#0e7490"
          strokeWidth={3}
          name="Revenue (Jt)"
          dot={{ r: 4, strokeWidth: 2, fill: '#0e7490' }}
          activeDot={{ r: 7 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="#f97316"
          strokeWidth={3}
          name="Orders"
          dot={{ r: 4, strokeWidth: 2, fill: '#f97316' }}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default RevenueTrendChart;
