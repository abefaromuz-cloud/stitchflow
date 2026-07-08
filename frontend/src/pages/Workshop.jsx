import { useState } from 'react';
import FabricShipment from './workshop/FabricShipment';
import Cutting from './workshop/Cutting';
import Bundles from './workshop/Bundles';
import BundleDetail from './workshop/BundleDetail';
import WorkshopQC from './workshop/WorkshopQC';

const TABS = [
  { id: 'fabric',   label: '🧶 Отгрузка ткани' },
  { id: 'cutting',  label: '✂️ Крой' },
  { id: 'bundles',  label: '📦 Пачки / Пошив' },
  { id: 'qc',       label: '🔍 ВТО / ОТК' },
];

export default function Workshop() {
  const [tab, setTab] = useState('fabric');
  const [selectedBundle, setSelectedBundle] = useState(null);

  if (selectedBundle) {
    return <BundleDetail bundleId={selectedBundle} onBack={()=>setSelectedBundle(null)} />;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-navy">Цех</h1>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              tab === t.id ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-navy'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fabric'  && <FabricShipment />}
      {tab === 'cutting' && <Cutting />}
      {tab === 'bundles' && <Bundles onSelectBundle={setSelectedBundle} />}
      {tab === 'qc'      && <WorkshopQC onSelectBundle={setSelectedBundle} />}
    </div>
  );
}
