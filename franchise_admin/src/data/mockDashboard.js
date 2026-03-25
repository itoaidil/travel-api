export const kpis = [
  {
    key: 'revenue_today',
    label: 'Pendapatan Hari Ini',
    value: 'Rp 12.450.000',
    delta: '+12.4%',
    trend: 'up'
  },
  {
    key: 'revenue_month',
    label: 'Pendapatan Bulan Ini',
    value: 'Rp 328.900.000',
    delta: '+8.1%',
    trend: 'up'
  },
  {
    key: 'active_drivers',
    label: 'Driver Aktif',
    value: '127',
    delta: '+5 driver',
    trend: 'up'
  },
  {
    key: 'active_customers',
    label: 'Customer Transaksi',
    value: '2.489',
    delta: '-1.9%',
    trend: 'down'
  }
];

export const revenueTrend = [
  { day: '01', revenue: 8.2, orders: 210 },
  { day: '05', revenue: 9.1, orders: 238 },
  { day: '10', revenue: 10.8, orders: 271 },
  { day: '15', revenue: 9.9, orders: 252 },
  { day: '20', revenue: 11.4, orders: 289 },
  { day: '25', revenue: 12.5, orders: 314 },
  { day: '30', revenue: 12.1, orders: 305 }
];

export const bookingStatus = [
  { name: 'Completed', value: 71 },
  { name: 'In Progress', value: 12 },
  { name: 'Pending', value: 9 },
  { name: 'Cancelled', value: 8 }
];

export const topDrivers = [
  { name: 'Andri Saputra', completed: 164 },
  { name: 'Raka Pratama', completed: 149 },
  { name: 'Wawan Santoso', completed: 137 },
  { name: 'Fikri Hidayat', completed: 124 },
  { name: 'Maman Sulaeman', completed: 118 }
];

export const areaPerformance = [
  { area: 'Cikupa', orders: 390, growth: 14 },
  { area: 'Balaraja', orders: 310, growth: 9 },
  { area: 'Panongan', orders: 287, growth: 7 },
  { area: 'Curug', orders: 252, growth: 4 },
  { area: 'Cisauk', orders: 200, growth: -2 }
];
