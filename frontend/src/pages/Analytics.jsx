import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Analytics() {
  const [insights, setInsights] = useState(null);
  const [bottlenecks, setBottlenecks] = useState(null);
  const [atRisk, setAtRisk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/ai/employees/insights'),
      api.get('/ai/bottlenecks'),
      api.get('/ai/at-risk-orders')
    ])
      .then(([insightsRes, bottlenecksRes, atRiskRes]) => {
        setInsights(insightsRes.data);
        setBottlenecks(bottlenecksRes.data.bottlenecks);
        setAtRisk(atRiskRes.data.at_risk_orders);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Загрузка...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">AI-Аналитика</h1>
      <p className="text-sm text-gray-500">
        Прогнозы и оценки рассчитываются на основе статистики выработки, посещаемости и истории этапов производства.
      </p>

      {/* Риск просрочки */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-navy mb-3">⏱ Заказы с риском просрочки</h2>
        {atRisk.length === 0 ? (
          <p className="text-sm text-green-600">Все активные заказы укладываются в срок</p>
        ) : (
          <div className="space-y-2">
            {atRisk.map((o) => (
              <div key={o.order_id} className="flex justify-between items-center text-sm border-b pb-2">
                <span className="font-medium">Заказ №{o.order_number}</span>
                <div className="text-right">
                  <p className="text-red-600 font-semibold">Опоздание на {o.days_late} дн.</p>
                  <p className="text-xs text-gray-400">
                    Срок: {new Date(o.due_date).toLocaleDateString('ru-RU')} · Прогноз: {new Date(o.estimated_date).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Лучшие сотрудники */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-navy mb-3">🏆 Лучшие по выработке</h2>
          {insights.top_performers.length === 0 ? (
            <p className="text-gray-400 text-sm">Нет данных</p>
          ) : (
            <div className="space-y-2">
              {insights.top_performers.map((e, idx) => (
                <div key={e.employee_id} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{idx + 1}. {e.full_name}</span>
                  <span className="text-navy font-semibold">{e.total_done} шт</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Высокий брак */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-navy mb-3">⚠️ Повышенный процент брака</h2>
          {insights.high_defect_employees.length === 0 ? (
            <p className="text-sm text-green-600">Брак в норме у всех сотрудников</p>
          ) : (
            <div className="space-y-2">
              {insights.high_defect_employees.map((e) => (
                <div key={e.employee_id} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{e.full_name}</span>
                  <span className="text-red-600 font-semibold">{e.defect_rate_percent}% ({e.total_defect} шт)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Посещаемость */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-navy mb-3">🗓 Опоздания / прогулы (30 дней)</h2>
          {insights.attendance_issues.length === 0 ? (
            <p className="text-sm text-green-600">Без нарушений за последние 30 дней</p>
          ) : (
            <div className="space-y-2">
              {insights.attendance_issues.map((e) => (
                <div key={e.employee_id} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{e.full_name}</span>
                  <span className="text-gray-600">
                    {e.late_count > 0 && <span className="text-yellow-600 mr-2">Опозданий: {e.late_count}</span>}
                    {e.absent_count > 0 && <span className="text-red-600">Прогулов: {e.absent_count}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Узкие места */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-navy mb-3">🔍 Узкие места производства</h2>
          {bottlenecks.length === 0 ? (
            <p className="text-gray-400 text-sm">Нет активных этапов</p>
          ) : (
            <div className="space-y-2">
              {bottlenecks.map((b) => (
                <div key={b.stage_name} className="flex justify-between items-center text-sm">
                  <span className="font-medium">
                    {b.stage_label} {b.is_bottleneck && '🔴'}
                  </span>
                  <div className="text-right">
                    <p className="text-navy font-semibold">{b.active_orders_count} заказ(ов)</p>
                    <p className="text-xs text-gray-400">
                      Среднее время: {b.current_avg_hours} ч
                      {b.historical_avg_hours && ` (норма: ${b.historical_avg_hours} ч)`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
