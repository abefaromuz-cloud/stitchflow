import { useEffect, useState } from 'react';
import api from '../api/client';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Присутствовал', color: 'bg-green-100 text-green-700' },
  { value: 'late', label: 'Опоздал', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'absent', label: 'Отсутствовал', color: 'bg-red-100 text-red-700' },
  { value: 'vacation', label: 'Отпуск', color: 'bg-blue-100 text-blue-700' },
  { value: 'sick', label: 'Больничный', color: 'bg-purple-100 text-purple-700' }
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function Attendance() {
  const [employees, setEmployees] = useState([]);
  const [date, setDate] = useState(todayISO());
  const [statuses, setStatuses] = useState({});
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/employees'),
      api.get('/attendance', { params: { /* current month */ } }),
      api.get('/attendance/summary')
    ])
      .then(([empRes, attRes, summaryRes]) => {
        setEmployees(empRes.data);
        setSummary(summaryRes.data);

        const initial = {};
        empRes.data.forEach((e) => (initial[e.id] = 'present'));
        attRes.data
          .filter((a) => a.work_date.startsWith(date))
          .forEach((a) => (initial[a.employee_id] = a.status));
        setStatuses(initial);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const records = Object.entries(statuses).map(([employee_id, status]) => ({ employee_id, status }));
      await api.post('/attendance/bulk', { work_date: date, records });
      setMessage('Посещаемость сохранена');
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">Посещаемость</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium text-gray-600">Дата:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>

        {loading ? (
          <p className="text-gray-500">Загрузка...</p>
        ) : (
          <div className="space-y-2">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between border-b py-2">
                <span className="font-medium text-sm">{emp.full_name}</span>
                <div className="flex gap-1">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatuses({ ...statuses, [emp.id]: opt.value })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        statuses[emp.id] === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-navy' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy/90 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {message && <p className="text-sm text-gray-500">{message}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-navy mb-4">Сводка за текущий месяц</h2>
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-left">
            <tr>
              <th className="py-2">Сотрудник</th>
              <th className="py-2">Присутствовал</th>
              <th className="py-2">Опоздания</th>
              <th className="py-2">Прогулы</th>
              <th className="py-2">Отпуск</th>
              <th className="py-2">Больничный</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.employee_id} className="border-t">
                <td className="py-2 font-medium">{s.full_name}</td>
                <td className="py-2 text-green-600">{s.present_days}</td>
                <td className="py-2 text-yellow-600">{s.late_days}</td>
                <td className="py-2 text-red-600">{s.absent_days}</td>
                <td className="py-2 text-blue-600">{s.vacation_days}</td>
                <td className="py-2 text-purple-600">{s.sick_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
