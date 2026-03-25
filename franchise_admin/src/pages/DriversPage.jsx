import { useEffect, useState } from 'react';
import SectionCard from '../components/SectionCard.jsx';
import { getFranchiseDrivers } from '../services/api.js';

function DriversPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await getFranchiseDrivers();
        if (!active) return;
        setRows(response.data || []);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Gagal memuat data driver');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SectionCard title="Performa Driver" subtitle="Driver yang melayani order franchise">
      {loading ? <p className="text-muted">Loading driver...</p> : null}
      {error ? <p className="text-danger">{error}</p> : null}
      {!loading && !error ? (
        <table className="area-table">
          <thead>
            <tr>
              <th>Nama Driver</th>
              <th>Telepon</th>
              <th>Kendaraan</th>
              <th>Completed</th>
              <th>Total Earnings</th>
              <th>Last Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.driver_id}>
                <td>{row.driver_name}</td>
                <td>{row.phone || '-'}</td>
                <td>{row.vehicle_type || '-'}</td>
                <td>{row.completed_orders}</td>
                <td>{formatCurrency(row.total_earnings)}</td>
                <td>{formatDate(row.last_completed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </SectionCard>
  );
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `Rp ${number.toLocaleString('id-ID')}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default DriversPage;
