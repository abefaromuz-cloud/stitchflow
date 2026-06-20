export default function StatCard({ title, value, subtitle, accent = 'navy' }) {
  const accentClasses = {
    navy: 'text-navy',
    gold: 'text-gold',
    red: 'text-red-600',
    green: 'text-green-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${accentClasses[accent] || accentClasses.navy}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
