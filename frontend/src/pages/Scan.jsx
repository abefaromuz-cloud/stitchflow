import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const publicApi = axios.create({ baseURL: '/api' });

const STAGE_ICONS = {
  received: '📥',
  cutting: '✂️',
  sewing: '🧵',
  overlock: '🪡',
  ironing: '🔥',
  qc: '🔍',
  packing: '📦',
  shipped: '✅'
};

export default function Scan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    setLoading(true);
    publicApi
      .get(`/qr/scan/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function completeStage(stageName) {
    setMessage('');
    try {
      await publicApi.post(`/qr/scan/${token}/complete-stage`, {
        stage_name: stageName,
        employee_id: employeeId || undefined
      });
      setMessage('Этап отмечен как выполненный ✅');
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Ошибка');
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-500">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!data) return null;

  const currentStage = data.stages.find((s) => s.status === 'in_progress');

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-navy text-white rounded-xl p-4">
          <h1 className="text-lg font-bold text-gold">StitchFlow</h1>
          <p className="text-sm">Заказ №{data.order.order_number}</p>
          <p className="text-xs text-white/70">{data.order.product_name} · {data.order.quantity} шт</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Кто выполняет (опционально)</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Не указано</option>
            {data.employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-navy mb-3">Карта производства</h2>
          <div className="space-y-2">
            {data.stages.map((stage) => (
              <div
                key={stage.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  stage.status === 'done'
                    ? 'bg-green-50 border-green-200'
                    : stage.status === 'in_progress'
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{STAGE_ICONS[stage.stage_name] || '•'}</span>
                  <span className="text-sm font-medium">{stage.stage_label}</span>
                </div>
                {stage.status === 'in_progress' ? (
                  <button
                    onClick={() => completeStage(stage.stage_name)}
                    className="text-xs bg-navy text-white px-3 py-1.5 rounded-lg font-medium"
                  >
                    Завершить
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">
                    {stage.status === 'done' ? 'Готово' : 'Ожидание'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {message && <p className="text-center text-sm text-navy font-medium">{message}</p>}
      </div>
    </div>
  );
}
