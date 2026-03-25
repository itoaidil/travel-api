function KpiCard({ label, value, delta, trend }) {
  return (
    <article className="kpi-card">
      <p className="kpi-label">{label}</p>
      <h3 className="kpi-value">{value}</h3>
      <p className={`kpi-delta ${trend === 'up' ? 'up' : 'down'}`}>
        {trend === 'up' ? '▲' : '▼'} {delta}
      </p>
    </article>
  );
}

export default KpiCard;
