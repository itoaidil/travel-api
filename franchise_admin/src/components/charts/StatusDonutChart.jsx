import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#0e9f6e', '#0891b2', '#f59e0b', '#ef4444'];

function StatusDonutChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={68}
          outerRadius={112}
          paddingAngle={4}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #d7e0f2'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default StatusDonutChart;
