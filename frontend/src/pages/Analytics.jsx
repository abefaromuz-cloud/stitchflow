import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Analytics() {
  const [insights, setInsights] = useState(null);
  const [atRisk, setAtRisk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/ai/employees/insights'), api.get('/ai/at-risk-orders')])
      .then(([ins, risk]) => { setInsights(ins.data); setAtRisk(risk.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Загрузка...</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy">AI-аналитика</h1>

      {atRisk?.at_risk_orders?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h2 className="font-semibold text-red-700 mb-2">⚠️ Заказы с риском просрочки</h2>
          <div className="space-y-2">
            {atRisk.at_risk_orders.map(o => (
              <div key={o.order_id} className="flex justify-between text-sm">
                <span className="text-red-700 font-medium">№{o.order_number}</span>
                <span className="text-red-500">Опоздание на {o.days_late} дн. · срок {new Date(o.due_date).toLocaleDateString('ru-RU')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {atRisk?.at_risk_orders?.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
          ✅ Все заказы укладываются в срок
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {insights?.top_performers?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-navy mb-3">🏆 Топ по выработке</h2>
            {insights.top_performers.map((e, i) => (
              <div key={e.employee_id} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                <span>{i===0?'🥇':i===1?'🥈':'🥉'} {e.full_name}</span>
                <span className="font-semibold text-navy">{Number(e.total_done).toLocaleString()} шт</span>
              </div>
            ))}
          </div>
        )}

        {insights?.high_defect_employees?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-red-600 mb-3">🔴 Высокий % брака</h2>
            {insights.high_defect_employees.map(e => (
              <div key={e.employee_id} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                <span>{e.full_name}</span>
                <span className="font-semibold text-red-600">{e.defect_rate_percent}%</span>
              </div>
            ))}
          </div>
        )}

        {insights?.high_rework_employees?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-amber-600 mb-3">🔄 Высокий % переделок</h2>
            {insights.high_rework_employees.map(e => (
              <div key={e.employee_id} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                <span>{e.full_name}</span>
                <span className="font-semibold text-amber-600">{e.rework_rate_percent}%</span>
              </div>
            ))}
          </div>
        )}

        {insights?.attendance_issues?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-orange-600 mb-3">📅 Нарушения посещаемости (30 дней)</h2>
            {insights.attendance_issues.map(e => (
              <div key={e.employee_id} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                <span>{e.full_name}</span>
                <span className="text-orange-600">опозданий: {e.late_count} · прогулов: {e.absent_count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
