import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const publicApi = axios.create({ baseURL: '/api' });

const STATUS_LABELS = {
  new: 'Новый', in_progress: 'В работе', cutting: 'Раскрой',
  sewing: 'Пошив', qc: 'Проверка качества', packing: 'Упаковка', completed: 'Завершён'
};
const STATUS_COLORS = {
  new: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700',
  cutting: 'bg-purple-100 text-purple-700', sewing: 'bg-indigo-100 text-indigo-700',
  qc: 'bg-yellow-100 text-yellow-700', packing: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700'
};
const INVOICE_STATUS = {
  unpaid: { label: 'Не оплачен', cls: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'Оплачен', cls: 'bg-green-100 text-green-700' },
  overdue: { label: 'Просрочен', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Отменён', cls: 'bg-gray-100 text-gray-500' }
};
const STAGE_LABELS = {
  received: 'Получен', cutting: 'Раскрой', sewing: 'Пошив',
  overlock: 'Оверлок', ironing: 'Утюжка', qc: 'Проверка', packing: 'Упаковка', shipped: 'Отгружен'
};
const STAGE_ICONS = {
  received: '📥', cutting: '✂️', sewing: '🧵', overlock: '🪡',
  ironing: '🔥', qc: '🔍', packing: '📦', shipped: '✅'
};

function ProgressBar({ value }) {
  const color = value >= 100 ? 'bg-green-500' : value >= 50 ? 'bg-blue-500' : 'bg-yellow-400';
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
      <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
    </div>
  );
}

export default function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    publicApi.get(`/client-portal/${token}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Ссылка недействительна или истекла'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400">Загрузка...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-gray-700 font-medium">{error}</p>
        <p className="text-gray-400 text-sm mt-1">Запросите актуальную ссылку у менеджера</p>
      </div>
    </div>
  );

  const { client, orders, invoices } = data;
  const activeOrders = orders.filter(o => o.status !== 'completed');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const unpaidTotal = invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + Number(i.total_amount), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-navy text-white px-6 py-5">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gold">StitchFlow</h1>
            <p className="text-white/60 text-sm">Кабинет клиента</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{client.company_name}</p>
            <p className="text-white/60 text-sm">{client.contact_person}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Карточки-сводка */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-navy">{activeOrders.length}</p>
            <p className="text-xs text-gray-400 mt-1">Активных заказов</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
            <p className="text-xs text-gray-400 mt-1">Завершённых</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-yellow-600">${unpaidTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">К оплате</p>
          </div>
        </div>

        {/* Активные заказы с картой производства */}
        {activeOrders.length > 0 && (
          <div>
            <h2 className="font-bold text-navy mb-3">Заказы в производстве</h2>
            <div className="space-y-3">
              {activeOrders.map(order => (
                <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full text-left p-4"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-navy">№{order.order_number}</p>
                        <p className="text-sm text-gray-500">{order.product_name} · {order.quantity} шт</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                        {order.due_date && (
                          <p className="text-xs text-gray-400 mt-1">срок {new Date(order.due_date).toLocaleDateString('ru-RU')}</p>
                        )}
                      </div>
                    </div>

                    {/* Прогресс-бар */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Выполнено: {order.done_qty} из {order.quantity} шт</span>
                        <span className="font-semibold text-navy">{order.percent_complete}%</span>
                      </div>
                      <ProgressBar value={order.percent_complete} />
                    </div>
                  </button>

                  {/* Карта производства (разворачивается) */}
                  {expandedOrder === order.id && order.stages.length > 0 && (
                    <div className="px-4 pb-4 border-t border-gray-50">
                      <p className="text-xs text-gray-400 mt-3 mb-2">Карта производства</p>
                      <div className="flex flex-wrap gap-2">
                        {order.stages.map((stage, idx) => (
                          <div key={idx} className="flex items-center">
                            <div className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs border min-w-[72px] ${
                              stage.status === 'done'
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : stage.status === 'in_progress'
                                ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                                : 'bg-gray-50 border-gray-200 text-gray-400'
                            }`}>
                              <span className="text-lg">{STAGE_ICONS[stage.stage_name] || '•'}</span>
                              <span className="font-medium text-center leading-tight mt-1">
                                {STAGE_LABELS[stage.stage_name] || stage.stage_name}
                              </span>
                              <span className="text-[10px] mt-0.5 opacity-70">
                                {stage.status === 'done' ? '✓' : stage.status === 'in_progress' ? 'сейчас' : '...'}
                              </span>
                            </div>
                            {idx < order.stages.length - 1 && (
                              <span className="text-gray-300 mx-1 text-xs">→</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Счета */}
        {invoices.length > 0 && (
          <div>
            <h2 className="font-bold text-navy mb-3">Счета</h2>
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-medium text-navy">№{inv.invoice_number}</p>
                    <p className="text-xs text-gray-400">
                      выставлен {new Date(inv.issue_date).toLocaleDateString('ru-RU')}
                      {inv.due_date && ` · срок ${new Date(inv.due_date).toLocaleDateString('ru-RU')}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-navy">${Number(inv.total_amount).toLocaleString()}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS[inv.status]?.cls}`}>
                      {INVOICE_STATUS[inv.status]?.label}
                    </span>
                    <div className="mt-1">
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-navy underline"
                      >
                        Скачать PDF
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* История завершённых */}
        {completedOrders.length > 0 && (
          <div>
            <h2 className="font-bold text-navy mb-3 text-sm text-gray-500">История заказов</h2>
            <div className="space-y-2">
              {completedOrders.slice(0, 5).map(order => (
                <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-navy">№{order.order_number} — {order.product_name}</p>
                    <p className="text-xs text-gray-400">{order.quantity} шт · {new Date(order.created_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <p className="font-semibold text-sm text-green-600">${Number(order.total_amount).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-gray-300 text-xs pb-4">
          StitchFlow · Кабинет клиента {client.company_name}
        </p>
      </div>
    </div>
  );
}
