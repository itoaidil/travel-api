import { useEffect, useState } from 'react';
import SectionCard from '../components/SectionCard.jsx';
import { getFranchiseTransactions } from '../services/api.js';

function TransactionsPage() {
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await getFranchiseTransactions({ status, page: 1, limit: 20 });
        if (!active) return;
        setRows(response.data || []);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Gagal memuat transaksi');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [status]);

  return (
    <SectionCard title="Daftar Transaksi" subtitle="Riwayat order franchise berdasarkan status">
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? <p className="text-muted">Loading transaksi...</p> : null}
      {error ? <p className="text-danger">{error}</p> : null}

      {!loading && !error ? (
        <table className="area-table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Customer</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Total</th>
              <th>Fee Franchise</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.booking_code}</td>
                <td>{row.customer_name || '-'}</td>
                <td>{row.driver_name || '-'}</td>
                <td>{row.booking_status}</td>
                <td>{formatCurrency(row.total_price)}</td>
                <td>{formatCurrency(row.franchise_fee)}</td>
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

export default TransactionsPage;
