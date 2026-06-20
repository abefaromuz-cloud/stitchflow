import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';

const STATUS_LABELS = {
  present: 'Присутствовал',
  late: 'Опоздал',
  absent: 'Отсутствовал',
  vacation: 'Отпуск',
  sick: 'Больничный'
};

const STATUS_COLORS = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-yellow-100 text-yellow-700',
  absent: 'bg-red-100 text-red-700',
  vacation: 'bg-blue-100 text-blue-700',
  sick: 'bg-purple-100 text-purple-700'
};

export default function EmployeeDetail() {
  const { id } = useParams();
  const [emp, setEmp] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/employees/${id}`)
      .then((res) => setEmp(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки'))
      .finally(() => setLoading(false));

    api.get(`/points/employee/${id}`).then((res) => setPoints(res.data)).catch(() => {});
  }, [id]);

  if (loading) return <p className="text-gray-500">Загрузка...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!emp) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{emp.full_name}</h1>
        <p className="text-gray-500 text-sm">{emp.position} · принят {new Date(emp.hire_date).toLocaleDateString('ru-RU')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Изготовлено всего" value={`${emp.total_done} шт`} />
        <StatCard title="Брак" value={emp.total_defect} accent={emp.total_defect > 5 ? 'red' : 'green'} />
        <StatCard title="Процент брака" value={`${emp.defect_rate_percent}%`} accent={Number(emp.defect_rate_percent) > 2 ? 'red' : 'green'} />
        <StatCard title="Оклад" value={Number(emp.base_salary).toLocaleString()} subtitle="сум/мес" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-navy mb-4">Посещаемость (текущий месяц)</h2>
        {emp.attendance.length === 0 ? (
          <p className="text-gray-400 text-sm">Нет данных за этот месяц</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {emp.attendance.map((a) => (
              <div
                key={a.work_date}
                className={`px-3 py-2 rounded-lg text-xs text-center min-w-[70px] ${STATUS_COLORS[a.status]}`}
              >
                <div className="font-semibold">{new Date(a.work_date).getDate()}</div>
                <div>{STATUS_LABELS[a.status]}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-navy mb-4">Последняя выработка</h2>
        {emp.recent_progress.length === 0 ? (
          <p className="text-gray-400 text-sm">Нет данных</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-left">
              <tr>
                <th className="py-2">Заказ</th>
                <th className="py-2">Этап</th>
                <th className="py-2">Сделано</th>
                <th className="py-2">Брак</th>
                <th className="py-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {emp.recent_progress.map((p, idx) => (
                <tr key={idx} className="border-t">
                  <td className="py-2">№{p.order_number} — {p.product_name}</td>
                  <td className="py-2 text-gray-500">{p.stage_name || '—'}</td>
                  <td className="py-2">{p.quantity_done} шт</td>
                  <td className="py-2 text-red-500">{p.quantity_defect}</td>
                  <td className="py-2 text-gray-400">{new Date(p.work_date).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {points.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-navy mb-4">🏆 История баллов</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-left">
                <tr>
                  <th className="py-2">Период</th>
                  <th className="py-2">Итого</th>
                  <th className="py-2">⚡ Скорость</th>
                  <th className="py-2">✅ Качество</th>
                  <th className="py-2">🗓 Посещ.</th>
                  <th className="py-2">Премия</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2">{p.period_month}/{p.period_year}</td>
                    <td className="py-2 font-bold text-navy">{p.total_points}</td>
                    <td className="py-2">{p.speed_points}</td>
                    <td className="py-2">{p.quality_points}</td>
                    <td className="py-2">{p.attendance_points}</td>
                    <td className="py-2">
                      {p.bonus_tier > 0
                        ? <span className="text-green-600 font-semibold">{Number(p.bonus_amount).toLocaleString()} сум</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
