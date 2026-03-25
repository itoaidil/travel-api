import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function DriverPerformanceChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(94, 109, 137, 0.25)" />
        <XAxis type="number" tick={{ fill: '#5e6d89' }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#5e6d89' }} />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #d7e0f2'
          }}
        />
        <Bar dataKey="completed" fill="#0ea5e9" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default DriverPerformanceChart;
