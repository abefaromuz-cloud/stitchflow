import { useEffect, useState } from 'react';
import api from '../api/client';

const STATUSES = [
  { value:'present',  label:'Присутствовал', cls:'bg-green-100 text-green-700 border-green-300' },
  { value:'late',     label:'Опоздал',        cls:'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value:'absent',   label:'Отсутствовал',   cls:'bg-red-100 text-red-700 border-red-300' },
  { value:'vacation', label:'Отпуск',          cls:'bg-blue-100 text-blue-700 border-blue-300' },
  { value:'sick',     label:'Больничный',      cls:'bg-purple-100 text-purple-700 border-purple-300' },
];

export default function Attendance() {
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/employees').then(r => {
      setEmployees(r.data);
      const init = {};
      r.data.forEach(e => { init[e.id] = 'present'; });
      setRecords(init);
    });
    loadSummary();
  }, []);

  useEffect(() => {
    api.get(`/attendance?work_date=${date}`).then(r => {
      const map = {};
      r.data.forEach(a => { map[a.employee_id] = a.status; });
      setRecords(prev => {
        const updated = { ...prev };
        Object.keys(map).forEach(id => { updated[id] = map[id]; });
        return updated;
      });
    });
  }, [date]);

  function loadSummary() {
    const now = new Date();
    api.get(`/attendance/summary?month=${now.getMonth()+1}&year=${now.getFullYear()}`).then(r => setSummary(r.data));
  }

  async function save() {
    setSaving(true);
    try {
      await api.post('/attendance/bulk', {
        work_date: date,
        records: employees.map(e => ({ employee_id: e.id, status: records[e.id]||'present' }))
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      loadSummary();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy">Посещаемость</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Дата</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold" />
          </div>
          <button onClick={save} disabled={saving}
            className="mt-5 bg-navy text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {saved ? '✓ Сохранено' : saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>

        <div className="space-y-2">
          {employees.map(emp => (
            <div key={emp.id} className="flex items-center gap-3 py-2 border-b last:border-0">
              <p className="w-48 font-medium text-navy text-sm">{emp.full_name}</p>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.map(s => (
                  <button key={s.value} onClick={() => setRecords({...records,[emp.id]:s.value})}
                    className={`px-3 py-1.5 rounded-lg text-xs border font-medium transition ${
                      records[emp.id]===s.value ? s.cls : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {summary.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-navy mb-3">Сводка за текущий месяц</h2>
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-left">
              <tr><th className="py-2">Сотрудник</th><th className="py-2">Присут.</th><th className="py-2">Опоздания</th><th className="py-2">Прогулы</th><th className="py-2">Отпуск</th><th className="py-2">Больничный</th></tr>
            </thead>
            <tbody>
              {summary.map(s => (
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
      )}
    </div>
  );
}
