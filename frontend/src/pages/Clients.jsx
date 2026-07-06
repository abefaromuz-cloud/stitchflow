import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [portalModal, setPortalModal] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState({ company_name:'', contact_person:'', phone:'', email:'', discount_percent:'' });
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get('/clients').then(r=>setClients(r.data)).finally(()=>setLoading(false));
  }
  useEffect(()=>{ load(); },[]);

  async function handleCreate(e) {
    e.preventDefault(); setError('');
    try { await api.post('/clients', form); setShowModal(false); setForm({company_name:'',contact_person:'',phone:'',email:'',discount_percent:''}); load(); }
    catch(err) { setError(err.response?.data?.error||'Ошибка'); }
  }

  async function openPortal(c) {
    const { data } = await api.get(`/client-portal/tokens/${c.id}`);
    setTokens(data); setPortalModal({ clientId:c.id, name:c.company_name });
  }

  async function createToken() {
    await api.post(`/client-portal/tokens/${portalModal.clientId}`, {});
    const { data } = await api.get(`/client-portal/tokens/${portalModal.clientId}`);
    setTokens(data);
  }

  async function revokeToken(tokenId) {
    await api.delete(`/client-portal/tokens/${tokenId}`);
    const { data } = await api.get(`/client-portal/tokens/${portalModal.clientId}`);
    setTokens(data);
  }

  function copyLink(token) {
    navigator.clipboard.writeText(`${window.location.origin}/client/${token}`);
    setCopied(token); setTimeout(()=>setCopied(''), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-navy">Клиенты</h1>
        <button onClick={()=>setShowModal(true)} className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium">+ Добавить</button>
      </div>

      {loading ? <p className="text-gray-400">Загрузка...</p> : (
        <div className="grid grid-cols-2 gap-4">
          {clients.map(c=>(
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-navy">{c.company_name}</p>
                  <p className="text-sm text-gray-400">{c.contact_person}</p>
                  {c.phone && <p className="text-xs text-gray-300 mt-0.5">{c.phone}</p>}
                </div>
                <div className="text-right text-xs">
                  <p className="text-gray-400">{c.orders_count} заказов</p>
                  <p className="font-semibold text-navy">₽{Number(c.total_orders_amount).toLocaleString()}</p>
                  {Number(c.debt_amount)>0 && <p className="text-red-500">Долг: ₽{Number(c.debt_amount).toLocaleString()}</p>}
                  {Number(c.discount_percent)>0 && <p className="text-green-600">Скидка: {c.discount_percent}%</p>}
                </div>
              </div>
              <button onClick={()=>openPortal(c)} className="mt-3 w-full text-xs bg-navy/5 hover:bg-navy/10 text-navy rounded-lg py-1.5 font-medium transition">
                🔗 Кабинет клиента
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Новый клиент</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Название компании *"
                value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} required />
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Контактное лицо"
                value={form.contact_person} onChange={e=>setForm({...form,contact_person:e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Телефон"
                  value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Email"
                  value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
              </div>
              <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Скидка %"
                value={form.discount_percent} onChange={e=>setForm({...form,discount_percent:e.target.value})} />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy text-white font-medium">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {portalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-navy mb-1">Кабинет клиента</h2>
            <p className="text-sm text-gray-400 mb-4">{portalModal.name}</p>
            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
              {tokens.filter(t=>t.is_active).map(t=>(
                <div key={t.id} className="border rounded-lg p-3 flex justify-between items-center text-sm">
                  <div className="overflow-hidden">
                    <p className="font-medium text-navy truncate">{t.label}</p>
                    <p className="text-gray-400 text-xs truncate">{window.location.origin}/client/{t.token}</p>
                  </div>
                  <div className="flex gap-2 ml-2 shrink-0">
                    <button onClick={()=>copyLink(t.token)} className={`text-xs px-2 py-1 rounded font-medium ${copied===t.token?'bg-green-100 text-green-700':'bg-navy/5 text-navy'}`}>
                      {copied===t.token?'Скопировано!':'Копировать'}
                    </button>
                    <button onClick={()=>revokeToken(t.id)} className="text-xs text-red-500 underline">Отозвать</button>
                  </div>
                </div>
              ))}
              {tokens.filter(t=>t.is_active).length===0 && <p className="text-gray-400 text-sm text-center py-3">Нет активных ссылок</p>}
            </div>
            <div className="flex justify-between">
              <button onClick={createToken} className="bg-navy text-white text-sm px-4 py-2 rounded-lg font-medium">+ Создать ссылку</button>
              <button onClick={()=>setPortalModal(null)} className="text-sm text-gray-400 hover:text-gray-600">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
