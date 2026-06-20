import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

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

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);

  function load() {
    setLoading(true);
    api
      .get(`/orders/${id}`)
      .then((res) => setOrder(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Ошибка загрузки'))
      .finally(() => setLoading(false));

    api.get(`/ai/orders/${id}/forecast`).then((res) => setForecast(res.data)).catch(() => {});
  }

  useEffect(() => {
    load();
  }, [id]);

  async function advanceStage(stage) {
    try {
      await api.put(`/orders/${id}/stages/${stage.stage_name}`, { status: 'done' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка обновления этапа');
    }
  }

  async function issueInvoice() {
    try {
      const invoiceNumber = `INV-${order.order_number}`;
      const { data } = await api.post('/invoices', {
        invoice_number: invoiceNumber,
        order_id: order.id,
        client_id: order.client_id,
        amount: order.total_amount,
        due_date: order.due_date
      });
      window.open(`/api/invoices/${data.id}/pdf`, '_blank');
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка выставления счета');
    }
  }

  if (loading) return <p className="text-gray-500">Загрузка...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!order) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-navy">Заказ №{order.order_number}</h1>
          <p className="text-gray-500 text-sm">{order.client_name} · {order.product_name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowQr(!showQr)}
            className="bg-white border border-gray-200 text-navy px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50"
          >
            {showQr ? 'Скрыть QR' : 'QR для цеха'}
          </button>
          <button
            onClick={issueInvoice}
            className="bg-gold text-navy px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
          >
            Выставить счет
          </button>
        </div>
      </div>

      {showQr && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
          <img src={`/api/qr/orders/${order.id}/image`} alt="QR для заказа" className="w-48 h-48" />
          <p className="text-xs text-gray-400 mt-2 text-center">
            Распечатайте и разместите на изделии/контейнере — мастер сканирует и отмечает этап выполнения
          </p>
        </div>
      )}

      {forecast && forecast.message && (
        <div className={`rounded-xl border p-4 text-sm ${forecast.warning ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          🤖 {forecast.message}
          {forecast.warning && <p className="mt-1 font-medium">{forecast.warning}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Количество</p>
          <p className="text-xl font-bold text-navy">{order.quantity} шт</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Цена за шт</p>
          <p className="text-xl font-bold text-navy">${Number(order.unit_price).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Сумма заказа</p>
          <p className="text-xl font-bold text-gold">${Number(order.total_amount).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Выполнено</p>
          <p className="text-xl font-bold text-green-600">{order.percent_complete}%</p>
        </div>
      </div>

      {/* Карта производства */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-navy mb-4">Карта производства</h2>
        <div className="flex flex-wrap items-center gap-2">
          {order.stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => stage.status !== 'done' && advanceStage(stage)}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition min-w-[100px] ${
                  stage.status === 'done'
                    ? 'bg-green-50 border-green-300'
                    : stage.status === 'in_progress'
                    ? 'bg-yellow-50 border-yellow-400 animate-pulse'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <span className="text-2xl">{STAGE_ICONS[stage.stage_name] || '•'}</span>
                <span className="text-xs font-medium text-center">{stage.stage_label}</span>
                <span className="text-[10px] text-gray-400">
                  {stage.status === 'done' ? 'Готово' : stage.status === 'in_progress' ? 'В работе' : 'Ожидание'}
                </span>
              </button>
              {idx < order.stages.length - 1 && <span className="text-gray-300 mx-1">→</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Нажмите на этап «В работе», чтобы отметить его выполненным</p>
      </div>

      {/* Прогресс сотрудников */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-navy mb-4">Участие сотрудников</h2>
        {order.progress.length === 0 ? (
          <p className="text-gray-400 text-sm">Пока нет данных о выработке</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-left">
              <tr>
                <th className="py-2">Сотрудник</th>
                <th className="py-2">Этап</th>
                <th className="py-2">Выполнено</th>
                <th className="py-2">Брак</th>
                <th className="py-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {order.progress.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 font-medium">{p.employee_name}</td>
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

      {order.description && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-navy mb-2">Описание</h2>
          <p className="text-sm text-gray-600">{order.description}</p>
        </div>
      )}
    </div>
  );
}
