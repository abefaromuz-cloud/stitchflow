import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [portalModal, setPortalModal] = useState(null); // { clientId, company_name }
  const [tokens, setTokens] = useState([]);
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    whatsapp: '',
    telegram: '',
    email: '',
    discount_percent: ''
  });
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get('/clients').then((res) => setClients(res.data)).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/clients', form);
      setShowModal(false);
      setForm({ company_name: '', contact_person: '', phone: '', whatsapp: '', telegram: '', email: '', discount_percent: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Ошибка');
    }
  }

  async function openPortalModal(client) {
    const { data } = await api.get(`/client-portal/tokens/${client.id}`);
    setTokens(data);
    setPortalModal({ clientId: client.id, company_name: client.company_name });
  }

  async function createToken(clientId) {
    await api.post(`/client-portal/tokens/${clientId}`, { label: 'Ссылка для клиента' });
    const { data } = await api.get(`/client-portal/tokens/${clientId}`);
    setTokens(data);
  }

  async function revokeToken(tokenId, clientId) {
    await api.delete(`/client-portal/tokens/${tokenId}`);
    const { data } = await api.get(`/client-portal/tokens/${clientId}`);
    setTokens(data);
  }

  function copyLink(token) {
    const url = `${window.location.origin}/client/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Клиенты</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy/90"
        >
          + Новый клиент
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="font-bold text-navy">{c.company_name}</p>
              <p className="text-sm text-gray-500">{c.contact_person}</p>
              <div className="mt-3 text-xs space-y-1 text-gray-500">
                {c.phone && <p>📞 {c.phone}</p>}
                {c.whatsapp && <p>💬 WhatsApp: {c.whatsapp}</p>}
                {c.telegram && <p>✈️ Telegram: {c.telegram}</p>}
                {c.email && <p>✉️ {c.email}</p>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Заказов</p>
                  <p className="font-semibold text-navy">{c.orders_count}</p>
                </div>
                <div>
                  <p className="text-gray-400">Сумма заказов</p>
                  <p className="font-semibold text-navy">${Number(c.total_orders_amount).toLocaleString()}</p>
                </div>
              </div>
              {Number(c.debt_amount) > 0 && (
                <p className="text-xs text-red-600 mt-2">Долг: ${Number(c.debt_amount).toLocaleString()}</p>
              )}
              {Number(c.discount_percent) > 0 && (
                <p className="text-xs text-green-600 mt-1">Скидка: {c.discount_percent}%</p>
              )}
              <button
                onClick={() => openPortalModal(c)}
                className="mt-3 w-full text-xs bg-navy/5 hover:bg-navy/10 text-navy rounded-lg py-1.5 font-medium transition"
              >
                🔗 Кабинет клиента
              </button>
            </div>
          ))}
          {clients.length === 0 && <p className="text-gray-400 col-span-full">Клиентов пока нет</p>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый клиент</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Название компании</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Контактное лицо</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Телефон</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telegram</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.telegram}
                    onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Скидка %</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.discount_percent}
                    onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал управления токенами клиентского кабинета */}
      {portalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-navy mb-1">Кабинет клиента</h2>
            <p className="text-sm text-gray-500 mb-4">{portalModal.company_name}</p>

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {tokens.filter(t => t.is_active).map(t => {
                const url = `${window.location.origin}/client/${t.token}`;
                return (
                  <div key={t.id} className="border rounded-lg p-3 flex justify-between items-center text-sm">
                    <div className="overflow-hidden">
                      <p className="font-medium text-navy truncate">{t.label}</p>
                      <p className="text-gray-400 text-xs truncate">{url}</p>
                    </div>
                    <div className="flex gap-2 ml-2 shrink-0">
                      <button
                        onClick={() => copyLink(t.token)}
                        className={`text-xs px-2 py-1 rounded font-medium ${copied === t.token ? 'bg-green-100 text-green-700' : 'bg-navy/5 text-navy'}`}
                      >
                        {copied === t.token ? 'Скопировано!' : 'Копировать'}
                      </button>
                      <button
                        onClick={() => revokeToken(t.id, portalModal.clientId)}
                        className="text-xs text-red-500 underline"
                      >
                        Отозвать
                      </button>
                    </div>
                  </div>
                );
              })}
              {tokens.filter(t => t.is_active).length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">Нет активных ссылок</p>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => createToken(portalModal.clientId)}
                className="text-sm bg-navy text-white px-4 py-2 rounded-lg font-medium"
              >
                + Создать ссылку
              </button>
              <button
                onClick={() => setPortalModal(null)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
