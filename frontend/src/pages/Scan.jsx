import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
const STAGE_ICONS = { received:'📥', cutting:'✂️', sewing:'🧵', overlock:'🪡', ironing:'🔥', qc:'🔍', packing:'📦', shipped:'✅' };

export default function Scan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  const [completing, setCompleting] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    api.get(`/qr/scan/${token}`)
      .then(r => setData(r.data))
      .catch(() => setError('QR-код недействителен'));
  }, [token]);

  async function completeStage(stageName) {
    setCompleting(stageName);
    try {
      await api.post(`/qr/scan/${token}/complete-stage`, { stage_name: stageName, employee_id: selectedEmp||null });
      setDone(stageName);
      const r = await api.get(`/qr/scan/${token}`);
      setData(r.data);
    } catch(err) {
      alert(err.response?.data?.error||'Ошибка');
    } finally { setCompleting(''); }
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><p className="text-4xl mb-2">❌</p><p className="text-gray-700">{error}</p></div>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Загрузка...</p></div>;

  const { order, stages, employees } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-navy text-white rounded-xl p-4 mb-4">
          <h1 className="text-xl font-bold text-gold">StitchFlow QR</h1>
          <p className="font-semibold mt-1">№{order.order_number}</p>
          <p className="text-white/60 text-sm">{order.product_name}</p>
        </div>

        {done && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm mb-3">✅ Этап завершён!</div>}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Выберите себя (необязательно)</label>
          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={selectedEmp} onChange={e=>setSelectedEmp(e.target.value)}>
            <option value="">Анонимно</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {stages.map(stage=>(
            <div key={stage.id} className={`bg-white rounded-xl border shadow-sm p-4 flex justify-between items-center ${
              stage.status==='done'?'border-green-200':stage.status==='in_progress'?'border-yellow-300':'border-gray-100'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{STAGE_ICONS[stage.stage_name]||'•'}</span>
                <div>
                  <p className="font-medium text-navy">{stage.stage_label}</p>
                  <p className="text-xs text-gray-400">{stage.status==='done'?'✓ Выполнено':stage.status==='in_progress'?'▶ В работе':'Ожидание'}</p>
                </div>
              </div>
              {stage.status==='in_progress' && (
                <button onClick={()=>completeStage(stage.stage_name)} disabled={completing===stage.stage_name}
                  className="bg-green-600 text-white text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-50">
                  {completing===stage.stage_name?'...':'Завершить'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
