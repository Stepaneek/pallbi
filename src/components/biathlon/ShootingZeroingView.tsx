import React, { useState } from 'react';
import { Target, RotateCcw, Undo2, Save, History, Users } from 'lucide-react';

interface Shot {
  id: number;
  x: number; // v mm od středu
  y: number; // v mm od středu
}

export const ShootingZeroingView: React.FC = () => {
  const [position, setPosition] = useState<'prone' | 'standing'>('prone');
  const [shots, setShots] = useState<Shot[]>([]);
  const [activeTab, setActiveTab] = useState<'zeroing' | 'history'>('zeroing');
  
  // Výběr člena týmu (včetně tebe a členů týmu)
  const [selectedAthlete, setSelectedAthlete] = useState<string>('Jirka');
  const [itemType, setItemType] = useState<'zeroing' | 'training' | 'race'>('zeroing');

  // Seznam členů týmu
  const teamMembers = ['Jirka', 'Adam', 'Štěpán'];

  // Skutečné biatlonové rozměry na 50 m:
  // Stoje / celá záměrná plocha = 115 mm průměr (poloměr 57.5 mm)
  // Ležka = 45 mm průměr (poloměr 22.5 mm)
  const OUTER_RADIUS = 57.5; // Celá plocha terče v mm
  const PRONE_RADIUS = 22.5;  // Černý střed pro ležku v mm

  // Obsluha kliknutí na terč
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (shots.length >= 10) return; // limit 10 ran na položku

    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Měřítko přepočtu pixelů na milimetry podle celkového průměru 115 mm
    const mmPerPixel = (OUTER_RADIUS * 2.2) / rect.width;

    const xMm = (svgX - centerX) * mmPerPixel;
    const yMm = -(svgY - centerY) * mmPerPixel; // v SVG osy směřují dolů, obracíme Y

    const newShot: Shot = {
      id: shots.length + 1,
      x: Math.round(xMm * 10) / 10,
      y: Math.round(yMm * 10) / 10,
    };

    setShots([...shots, newShot]);
  };

  const handleUndo = () => {
    setShots(shots.slice(0, -1));
  };

  const handleReset = () => {
    setShots([]);
  };

  // Výpočty
  const count = shots.length;
  const avgX = count > 0 ? shots.reduce((acc, s) => acc + s.x, 0) / count : 0;
  const avgY = count > 0 ? shots.reduce((acc, s) => acc + s.y, 0) / count : 0;

  // Vzdálenost středu od nuly (v mm)
  const distance = Math.sqrt(avgX * avgX + avgY * avgY);

  // Hodinový směr
  const getClockDirection = (x: number, y: number) => {
    if (x === 0 && y === 0) return "Na středu";
    let angleRad = Math.atan2(x, y);
    let angleDeg = (angleRad * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    const hour = Math.round(angleDeg / 30);
    const clockHour = hour === 0 ? 12 : hour;
    return `${clockHour}:00`;
  };

  const clockDir = getClockDirection(avgX, avgY);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 text-slate-100">
      {/* Hlavička */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="text-blue-500" /> Střelecký záznamník & Nástřel
          </h1>
          <p className="text-sm text-slate-400">Záznam ran pro členy týmu na střelnici</p>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('zeroing')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'zeroing' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Nová položka
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <History size={16} /> Historie
          </button>
        </div>
      </div>

      {activeTab === 'zeroing' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Levý panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users size={18} className="text-blue-400" /> Člen týmu & Typ položky
              </h2>

              {/* Výběr člena týmu */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Člen týmu</label>
                <select
                  value={selectedAthlete}
                  onChange={(e) => setSelectedAthlete(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {teamMembers.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
              </div>

              {/* Typ položky */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Druh střelby</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setItemType('zeroing')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition ${itemType === 'zeroing' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
                  >
                    Nástřel
                  </button>
                  <button
                    onClick={() => setItemType('training')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition ${itemType === 'training' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
                  >
                    Trénink
                  </button>
                  <button
                    onClick={() => setItemType('race')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition ${itemType === 'race' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
                  >
                    Závod
                  </button>
                </div>
              </div>

              {/* Volba polohy */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Poloha</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setPosition('prone'); setShots([]); }}
                    className={`py-3 px-4 rounded-xl font-medium border text-sm transition ${position === 'prone' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-300'}`}
                  >
                    Ležka (Prone)
                    <span className="block text-xs text-slate-400 mt-0.5">Střed 45 mm</span>
                  </button>
                  <button
                    onClick={() => { setPosition('standing'); setShots([]); }}
                    className={`py-3 px-4 rounded-xl font-medium border text-sm transition ${position === 'standing' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-300'}`}
                  >
                    Stoje (Standing)
                    <span className="block text-xs text-slate-400 mt-0.5">Střed 115 mm</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleUndo}
                  disabled={shots.length === 0}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Undo2 size={16} /> Zpět
                </button>
                <button
                  onClick={handleReset}
                  disabled={shots.length === 0}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 disabled:opacity-40 py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw size={16} /> Vyčistit
                </button>
              </div>
            </div>

            {/* Panel výsledků */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold">Výsledky položky</h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Počet ran:</span>
                  <span className="font-bold">{count} / 5</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Střední zásah (hodiny):</span>
                  <span className="font-bold text-blue-400">{count > 0 ? clockDir : '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Vzdálenost od středu:</span>
                  <span className="font-bold">{count > 0 ? `${Math.round(distance * 10) / 10} mm` : '-'}</span>
                </div>
              </div>

              <button
                onClick={() => alert(`Střelecká položka pro uživatele ${selectedAthlete} byla úspěšně uložena do deníku!`)}
                disabled={count === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/20"
              >
                <Save size={18} /> Uložit položku do deníku
              </button>
            </div>
          </div>

          {/* Pravý panel: Interaktivní Terč reálných proporcí */}
          <div className="lg:col-span-8 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center relative min-h-[450px]">
            <div className="absolute top-4 left-4 text-xs text-slate-400">
              Klikněte do terče pro zapsání ran ({shots.length}/10)
            </div>

            {/* SVG Terč s reálným poměrem 115mm vs 45mm */}
            <div className="w-full max-w-[420px] aspect-square relative flex items-center justify-center">
              <svg
                viewBox="-65 -65 130 130"
                className="w-full h-full cursor-crosshair select-none drop-shadow-2xl"
                onClick={handleSvgClick}
              >
                {/* Vnější pozadí celého trenažéru/terče */}
                <circle cx="0" cy="0" r="62.5" fill="#1e293b" stroke="#334155" strokeWidth="1" />

                {/* Plocha pro STOJE (115 mm průměr -> poloměr 57.5 mm) */}
                <circle
                  cx="0"
                  cy="0"
                  r={OUTER_RADIUS}
                  fill={position === 'standing' ? '#0f172a' : '#1e293b'}
                  stroke="#475569"
                  strokeWidth="1.5"
                />

                {/* Plocha pro LEŽKU (45 mm průměr -> poloměr 22.5 mm) */}
                <circle
                  cx="0"
                  cy="0"
                  r={PRONE_RADIUS}
                  fill={position === 'prone' ? '#0f172a' : 'none'}
                  stroke={position === 'prone' ? '#64748b' : '#334155'}
                  strokeWidth="1.5"
                  strokeDasharray={position === 'standing' ? '3 3' : 'none'}
                />

                {/* Středový křížek */}
                <line x1="-4" y1="0" x2="4" y2="0" stroke="#64748b" strokeWidth="0.8" />
                <line x1="0" y1="-4" x2="0" y2="4" stroke="#64748b" strokeWidth="0.8" />

                {/* Zaznamenané rány */}
                {shots.map((shot) => (
                  <g key={shot.id} transform={`translate(${shot.x}, ${-shot.y})`}>
                    <circle r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" className="transition-all duration-200" />
                    <text x="0" y="1.5" textAnchor="middle" fill="#ffffff" fontSize="4.5" fontWeight="bold">
                      {shot.id}
                    </text>
                  </g>
                ))}

                {/* Střední zásah (průměr) */}
                {count > 0 && (
                  <g transform={`translate(${avgX}, ${-avgY})`} className="transition-all duration-300">
                    <circle r="4.5" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="1.5 1.5" />
                    <circle r="1.2" fill="#ef4444" />
                  </g>
                )}
              </svg>
            </div>

            {/* Seznam zaznamenaných ran */}
            <div className="w-full mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-2 items-center justify-center">
              <span className="text-xs text-slate-400 mr-2">Zaznamenané rány:</span>
              {shots.length === 0 ? (
                <span className="text-xs text-slate-500 italic">Žádné rány</span>
              ) : (
                shots.map((s) => (
                  <span key={s.id} className="bg-slate-800 border border-slate-700 text-xs px-2.5 py-1 rounded-lg text-slate-300">
                    #{s.id}: [{s.x > 0 ? `+${s.x}` : s.x}, {s.y > 0 ? `+${s.y}` : s.y}] mm
                  </span>
                ))
              )}
            </div>
          </div>

        </div>
      ) : (
        /* Sekce Historie */
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 text-center py-16 space-y-3">
          <History size={48} className="mx-auto text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-300">Historie střeleckých položek</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Zde se zobrazují všechny zaznamenané položky (nástřely, tréninky i závody) pro vybraného člena týmu.
          </p>
        </div>
      )}
    </div>
  );
};