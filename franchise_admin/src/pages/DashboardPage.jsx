import { useEffect, useMemo, useState } from 'react';
import KpiCard from '../components/KpiCard.jsx';
import SectionCard from '../components/SectionCard.jsx';
import DriverPerformanceChart from '../components/charts/DriverPerformanceChart.jsx';
import RevenueTrendChart from '../components/charts/RevenueTrendChart.jsx';
import StatusDonutChart from '../components/charts/StatusDonutChart.jsx';
import { areaPerformance as areaMock, bookingStatus as statusMock, kpis as kpiMock, revenueTrend as trendMock, topDrivers as driverMock } from '../data/mockDashboard.js';
import { getFranchiseDashboard } from '../services/api.js';

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await getFranchiseDashboard();
        if (!active) return;
        setData(response.data);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Gagal memuat dashboard live, menampilkan mock data');
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const kpiCards = useMemo(() => {
    if (!data?.kpi) return kpiMock;
    const kpi = data.kpi;
    return [
      {
        key: 'revenue_total',
        label: 'Pendapatan Gross',
        value: formatCurrency(kpi.total_revenue),
        delta: 'Live',
        trend: 'up'
      },
      {
        key: 'revenue_franchise',
        label: 'Pendapatan Franchise',
        value: formatCurrency(kpi.franchise_revenue),
        delta: 'Live',
        trend: 'up'
      },
      {
        key: 'drivers_serving',
        label: 'Driver Melayani',
        value: String(kpi.drivers_serving || 0),
        delta: 'Live',
        trend: 'up'
      },
      {
        key: 'customers_transacting',
        label: 'Customer Transaksi',
        value: String(kpi.customers_transacting || 0),
        delta: 'Live',
        trend: 'up'
      }
    ];
  }, [data]);

  const trend = data?.revenue_trend?.length
    ? data.revenue_trend.map((x) => ({ day: x.day?.slice(5) || '-', revenue: Number(x.revenue || 0), orders: Number(x.orders || 0) }))
    : trendMock;

  const status = data?.status_breakdown?.length
    ? data.status_breakdown.map((x) => ({ name: toTitle(x.name), value: Number(x.value || 0) }))
    : statusMock;

  const topDrivers = data?.top_drivers?.length
    ? data.top_drivers.map((x) => ({ name: x.name, completed: Number(x.completed || 0) }))
    : driverMock;

  const areaPerformance = data?.area_performance?.length ? data.area_performance : areaMock;

  return (
    <>
      {loading ? <p className="text-muted mt-2">Loading dashboard...</p> : null}
      {error ? <p className="text-danger mt-2">{error}</p> : null}

      <section className="kpi-grid">
        {kpiCards.map((kpi) => (
          <KpiCard key={kpi.key} {...kpi} />
        ))}
      </section>

      <section className="content-grid">
        <SectionCard title="Tren Pendapatan & Order" subtitle="Pergerakan performa periodik franchise">
          <RevenueTrendChart data={trend} />
        </SectionCard>

        <SectionCard title="Komposisi Status Transaksi" subtitle="Distribusi status booking saat ini">
          <StatusDonutChart data={status} />
          <ul className="legend-list">
            {status.map((s) => (
              <li key={s.name}>
                <span>{s.name}</span>
                <strong>{s.value}</strong>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Top Driver by Completed Orders" subtitle="Driver dengan penyelesaian order tertinggi">
          <DriverPerformanceChart data={topDrivers} />
        </SectionCard>

        <SectionCard title="Performa Area Coverage" subtitle="Area dengan kontribusi order terbesar">
          <table className="area-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Orders</th>
                <th>Growth</th>
              </tr>
            </thead>
            <tbody>
              {areaPerformance.map((row) => (
                <tr key={row.area}>
                  <td>{row.area}</td>
                  <td>{row.orders}</td>
                  <td className={Number(row.growth) >= 0 ? 'positive' : 'negative'}>
                    {Number(row.growth) >= 0 ? '+' : ''}
                    {Number(row.growth || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </section>
    </>
  );
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `Rp ${number.toLocaleString('id-ID')}`;
}

function toTitle(value) {
  if (!value) return '-';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default DashboardPage;
