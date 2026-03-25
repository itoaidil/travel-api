import { useEffect, useState } from 'react';
import SectionCard from '../components/SectionCard.jsx';
import { getFranchiseCustomers } from '../services/api.js';

function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await getFranchiseCustomers();
        if (!active) return;
        setRows(response.data || []);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Gagal memuat data customer');
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
    <SectionCard title="Customer Transaksi" subtitle="Customer yang sudah melakukan transaksi di franchise ini">
      {loading ? <p className="text-muted">Loading customer...</p> : null}
      {error ? <p className="text-danger">{error}</p> : null}
      {!loading && !error ? (
        <table className="area-table">
          <thead>
            <tr>
              <th>Nama Customer</th>
              <th>Telepon</th>
              <th>Total Transaksi</th>
              <th>Gross Spend</th>
              <th>Last Transaction</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.customer_id}>
                <td>{row.customer_name || '-'}</td>
                <td>{row.customer_phone || '-'}</td>
                <td>{row.transactions}</td>
                <td>{formatCurrency(row.gross_spend)}</td>
                <td>{formatDate(row.last_transaction_at)}</td>
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

export default CustomersPage;
