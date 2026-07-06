import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navItems = [
  { to:'/',          label:'Дашборд',      icon:'📊', end:true },
  { to:'/orders',    label:'Заказы',        icon:'🧵' },
  { to:'/clients',   label:'Клиенты',       icon:'🏢' },
  { to:'/employees', label:'Сотрудники',    icon:'👥' },
  { to:'/attendance',label:'Посещаемость',  icon:'🗓️' },
  { to:'/salary',    label:'Зарплата',      icon:'💰' },
  { to:'/warehouse', label:'Склад',         icon:'📦' },
  { to:'/finance',   label:'Финансы',       icon:'📈' },
  { to:'/motivation',label:'Мотивация',     icon:'🏆' },
  { to:'/analytics', label:'AI-аналитика',  icon:'🤖' },
  { to:'/telegram',  label:'Telegram',      icon:'✈️' },
  { to:'/tv',        label:'ТВ-дашборд',    icon:'📺' },
  { to:'/settings',  label:'Настройки',     icon:'⚙️' },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('sf_user') || 'null');

  function logout() {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-navy text-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-white/10">
          <h1 className="text-xl font-bold text-gold">StitchFlow</h1>
          <p className="text-[10px] text-white/40 mt-0.5">Контроль каждого стежка</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition ${
                  isActive ? 'bg-gold text-navy font-semibold' : 'text-white/70 hover:bg-white/10'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <p className="text-xs font-medium text-white/80">{user?.full_name}</p>
          <p className="text-[10px] text-white/40 mb-2">{user?.role}</p>
          <button onClick={logout} className="w-full text-xs bg-white/10 hover:bg-white/20 rounded-lg py-1.5 transition">
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
