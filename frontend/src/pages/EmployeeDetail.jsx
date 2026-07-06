import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import StatCard from '../components/StatCard';

export default function EmployeeDetail() {
  const { id } = useParams();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/employees/${id}`).then(r=>setEmp(r.data)).finally(()=>setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-400">Загрузка...</p>;
  if (!emp) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy">{emp.full_name}</h1>
      <p className="text-gray-400 -mt-3">{emp.position}</p>

      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Изготовлено" value={`${Number(emp.total_done).toLocaleString()} шт`} />
        <StatCard title="Брак" value={`${emp.defect_rate_percent}%`} accent={Number(emp.defect_rate_percent)>2?'red':'green'} />
        <StatCard title="Переделки" value={`${emp.rework_rate_percent}%`} accent={Number(emp.rework_rate_percent)>3?'red':'gold'} />
        <StatCard title="Оклад" value={`₽${Number(emp.base_salary).toLocaleString()}`} />
      </div>

      {/* Посещаемость за месяц */}
      {emp.attendance?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-navy mb-3">Посещаемость за текущий месяц</h2>
          <div className="flex flex-wrap gap-2">
            {emp.attendance.map(a => (
              <div key={a.work_date} className={`px-2 py-1 rounded-lg text-xs font-medium ${
                a.status==='present'?'bg-green-100 text-green-700':
                a.status==='late'?'bg-yellow-100 text-yellow-700':
                a.status==='absent'?'bg-red-100 text-red-700':
                'bg-blue-100 text-blue-700'
              }`}>
                {new Date(a.work_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* История баллов */}
      {emp.points_history?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-navy mb-3">История баллов</h2>
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-left">
              <tr>
                <th className="py-2">Период</th>
                <th className="py-2">Скорость</th>
                <th className="py-2">Качество</th>
                <th className="py-2">Посещ.</th>
                <th className="py-2">Итого</th>
                <th className="py-2">Брак %</th>
                <th className="py-2">Переделки %</th>
                <th className="py-2">Премия</th>
              </tr>
            </thead>
            <tbody>
              {emp.points_history.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{p.period_month}/{p.period_year}</td>
                  <td className="py-2">{p.speed_points}</td>
                  <td className="py-2">{p.quality_points}</td>
                  <td className="py-2">{p.attendance_points}</td>
                  <td className="py-2 font-bold text-navy">{p.total_points}</td>
                  <td className="py-2 text-red-500">{p.defect_rate_percent}%</td>
                  <td className="py-2 text-amber-500">{p.rework_rate_percent}%</td>
                  <td className="py-2 text-green-600">
                    {Number(p.bonus_amount)>0?`₽${Number(p.bonus_amount).toLocaleString()}`:'—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Последняя выработка */}
      {emp.recent_progress?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-navy mb-3">Последние записи выработки</h2>
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-left">
              <tr><th className="py-2">Заказ</th><th className="py-2">Изделие</th><th className="py-2">Этап</th><th className="py-2">Выполнено</th><th className="py-2">Брак</th><th className="py-2">Переделки</th><th className="py-2">Дата</th></tr>
            </thead>
            <tbody>
              {emp.recent_progress.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">№{p.order_number}</td>
                  <td className="py-2 text-gray-500">{p.item_name||p.product_name}</td>
                  <td className="py-2 text-gray-400">{p.stage_name||'—'}</td>
                  <td className="py-2">{p.quantity_done} шт</td>
                  <td className="py-2 text-red-500">{p.quantity_defect}</td>
                  <td className="py-2 text-amber-500">{p.quantity_rework}</td>
                  <td className="py-2 text-gray-400">{new Date(p.work_date).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
