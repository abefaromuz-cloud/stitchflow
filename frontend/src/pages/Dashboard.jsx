import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard';

const STATUS_LABELS = { new:'Новый', in_progress:'В работе', cutting:'Раскрой', sewing:'Пошив', qc:'Проверка QC', packing:'Упаковка', completed:'Завершён' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [atRisk, setAtRisk] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/ai/at-risk-orders')])
      .then(([d, r]) => { setData(d.data); setAtRisk(r.data.at_risk_orders||[]); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!data) return null;

  const workload = (data.employee_workload||[]).map(e=>({ name:e.full_name.split(' ')[0], done:Number(e.done_today) }));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy">Дашборд</h1>

      {atRisk.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          🤖 <b>AI-предупреждение:</b> {atRisk.map(o=>`Заказ №${o.order_number} — опоздание на ${o.days_late} дн.`).join(' · ')}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Активных заказов" value={data.orders.active} />
        <StatCard title="Выполнено" value={data.orders.completed} accent="green" />
        <StatCard title="Просрочено" value={data.orders.overdue} accent="red" />
        <StatCard title="Доход за месяц" value={`₽${Number(data.finance.monthly_revenue).toLocaleString()}`} accent="gold" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-navy mb-3">Выработка сотрудников сегодня</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={workload}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{fontSize:11}} />
              <YAxis tick={{fontSize:11}} />
              <Tooltip />
              <Bar dataKey="done" fill="#0F1F3D" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-rows-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-navy mb-2">Заказы по статусам</p>
            <div className="space-y-1">
              {data.orders.by_status.map(s => (
                <div key={s.status} className="flex justify-between text-sm">
                  <span className="text-gray-500">{STATUS_LABELS[s.status]||s.status}</span>
                  <span className="font-semibold text-navy">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {data.top_employee && (
            <div className="bg-navy rounded-xl p-4 text-white">
              <p className="text-xs text-white/50 mb-1">🏆 Лучший сотрудник</p>
              <p className="font-bold text-gold">{data.top_employee.full_name}</p>
              <p className="text-sm text-white/60 mt-1">{Number(data.top_employee.total_done).toLocaleString()} изд. · брак {data.top_employee.defect_rate_percent}% · переделки {data.top_employee.rework_rate_percent}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
