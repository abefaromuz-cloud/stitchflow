import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard';

const STATUS_LABELS = {
  new: 'Новый',
  in_progress: 'В работе',
  cutting: 'Раскрой',
  sewing: 'Пошив',
  qc: 'Проверка качества',
  packing: 'Упаковка',
  completed: 'Завершен'
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [atRisk, setAtRisk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки'))
      .finally(() => setLoading(false));

    api.get('/ai/at-risk-orders').then((res) => setAtRisk(res.data.at_risk_orders)).catch(() => {});
  }, []);

  if (loading) return <p className="text-gray-500">Загрузка...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  const workloadChartData = (data.employee_workload || []).map((e) => ({
    name: e.full_name.split(' ')[0],
    done: Number(e.done_today)
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">Дашборд</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Активные заказы" value={data.orders.active} />
        <StatCard title="Выполненные заказы" value={data.orders.completed} accent="green" />
        <StatCard title="Просроченные заказы" value={data.orders.overdue} accent="red" />
        <StatCard title="Всего заказов" value={data.orders.total} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="Доход за месяц"
          value={`$${Number(data.finance.monthly_revenue).toLocaleString()}`}
          accent="gold"
        />
        <StatCard
          title="Выплаты сотрудникам (месяц)"
          value={`${Number(data.finance.monthly_payouts).toLocaleString()} сум`}
        />
      </div>

      {atRisk.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h2 className="font-semibold text-red-700 mb-2">🤖 AI: риск просрочки заказов</h2>
          <div className="space-y-1 text-sm text-red-700">
            {atRisk.map((o) => (
              <p key={o.order_id}>
                Заказ №{o.order_number} — прогноз на {o.days_late} дн. позже срока ({new Date(o.due_date).toLocaleDateString('ru-RU')})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-navy mb-3">Заказы по статусам</h2>
          <div className="space-y-2">
            {data.orders.by_status.map((s) => (
              <div key={s.status} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{STATUS_LABELS[s.status] || s.status}</span>
                <span className="font-semibold text-navy">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-navy mb-3">🏆 Лучший сотрудник</h2>
          {data.top_employee ? (
            <div>
              <p className="text-lg font-bold text-navy">{data.top_employee.full_name}</p>
              <p className="text-sm text-gray-500">Изготовлено: {data.top_employee.total_done} шт</p>
              <p className="text-sm text-gray-500">Брак: {data.top_employee.defect_rate_percent}%</p>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Нет данных</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-navy mb-3">Выработка сотрудников сегодня</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={workloadChartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="done" fill="#0F1F3D" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.top_employee && (
        <div className="bg-gradient-to-r from-navy to-navy/80 text-white rounded-xl p-5">
          <p className="text-xs text-white/60 mb-1">🏆 Лучший сотрудник месяца</p>
          <p className="text-xl font-bold text-gold">{data.top_employee.full_name}</p>
          <p className="text-sm text-white/80 mt-1">
            {data.top_employee.total_done} изделий · брак {data.top_employee.defect_rate_percent}%
          </p>
        </div>
      )}
    </div>
  );
}
