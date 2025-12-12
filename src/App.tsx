import React, { useState, useRef, useCallback } from 'react';
import { ThreeViewer } from './components/ThreeViewer';
import { FolderOpen, Info, ShieldCheck, UploadCloud, Play, FileSpreadsheet, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const App = () => {
  const [activePanel, setActivePanel] = useState('properties');
  const [selection, setSelection] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [idsFile, setIdsFile] = useState<{name: string, ruleCount: number} | null>(null);
  const [ifcFileUrl, setIfcFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("Projet_Demo.ifc");
  const [auditStats, setAuditStats] = useState<any>(null);
  const [auditDetails, setAuditDetails] = useState<any[] | null>(null);

  const idsInputRef = useRef<HTMLInputElement>(null);
  const ifcInputRef = useRef<HTMLInputElement>(null);

  // Memoize to prevent ThreeViewer re-renders
  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleSelection = useCallback((id: string | null) => {
    setSelection(id);
  }, []);

  const handleIfcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setIfcFileUrl(URL.createObjectURL(file));
      setAuditStats(null);
    }
  };

  const handleIdsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const matches = content.match(/specification/gi);
        setIdsFile({ name: file.name, ruleCount: matches ? Math.ceil(matches.length / 2) : 0 });
        showNotification(`Standard IDS Chargé : ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  const handleRunIDS = () => {
    if (!idsFile) return;
    showNotification(`Audit en cours sur ${fileName}...`);
    setTimeout(() => {
      const results = [
        { id: "1", element: "Mur Extérieur 01", status: "PASS", message: "Code GID valide (21.12)" },
        { id: "2", element: "Fenêtre 04", status: "FAIL", message: "Propriété AcousticRating manquante" },
        { id: "3", element: "Dalle R+1", status: "WARNING", message: "Classification incertaine" },
      ];
      setAuditDetails(results);
      setAuditStats({ score: 65, pass: 1, fail: 1, warning: 1, total: 3 });
      setActivePanel('ids');
      showNotification("Audit terminé !");
    }, 1500);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <input type="file" ref={idsInputRef} onChange={handleIdsUpload} accept=".ids,.xml" className="hidden" />
      <input type="file" ref={ifcInputRef} onChange={handleIfcUpload} accept=".ifc" className="hidden" />

      {/* SIDEBAR GAUCHE */}
      <div className="w-16 flex flex-col items-center py-4 bg-slate-900 border-r border-slate-700 z-10">
        <div className="mb-8 flex flex-col items-center justify-center cursor-default select-none">
            <div className="text-2xl font-black tracking-[0.2em] text-[#0E2C50] leading-none" style={{ marginLeft: '0.2em' }}>BIM</div>
            <div className="text-[0.6rem] font-bold text-[#6C6A6B] uppercase tracking-widest w-full text-center leading-none mt-1">SMARTER</div>
        </div>
        <NavButton onClick={() => ifcInputRef.current?.click()} icon={<FolderOpen size={20} />} title="Ouvrir IFC" />
        <div className="h-px w-8 bg-slate-700 my-2"></div>
        <NavButton active={activePanel === 'properties'} onClick={() => setActivePanel('properties')} icon={<Info size={20} />} title="Propriétés" />
        <NavButton active={activePanel === 'ids'} onClick={() => setActivePanel('ids')} icon={<ShieldCheck size={20} />} title="Audit" />
      </div>

      {/* CENTRE */}
      <div className="flex-grow relative bg-gray-200">
        <div className="absolute top-4 left-4 right-4 h-12 flex items-center px-4 justify-between z-10 shadow-lg text-sm border border-slate-600 bg-slate-800/90 backdrop-blur rounded-lg">
             <div className="flex items-center gap-3">
               <span className="font-semibold text-white">{fileName}</span>
               {ifcFileUrl && <span className="text-[10px] bg-blue-900 px-2 py-0.5 rounded text-blue-200 font-bold">IFC Loaded</span>}
             </div>
             <div className="flex items-center text-slate-300 gap-2"><FileSpreadsheet size={16}/> Export Data</div>
        </div>
        <ThreeViewer ifcFileUrl={ifcFileUrl} onSelect={handleSelection} setNotification={showNotification} />
      </div>

      {/* SIDEBAR DROITE */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col shadow-xl z-20">
        <div className="h-14 border-b border-slate-700 flex items-center px-4 gap-3 bg-slate-800">
            {activePanel === 'ids' ? <ShieldCheck className="text-blue-500" size={20} /> : <Info className="text-blue-500" size={20} />}
            <span className="font-bold text-white tracking-wide">{activePanel === 'ids' ? 'Audit Manager' : 'Inspecteur'}</span>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
            {activePanel === 'ids' ? (
                <div className="space-y-4">
                    {!idsFile ? (
                        <Button variant="outline" onClick={() => idsInputRef.current?.click()} className="w-full h-20 border-dashed border-slate-600 flex flex-col gap-2">
                            <UploadCloud size={24} /> Charger standard (.ids)
                        </Button>
                    ) : (
                        <div className="bg-slate-700 p-3 rounded border border-blue-500/50 flex justify-between items-center">
                            <div>
                                <div className="font-bold text-white text-sm">{idsFile.name}</div>
                                <div className="text-xs text-slate-400">{idsFile.ruleCount} règles</div>
                            </div>
                            <button onClick={() => setIdsFile(null)} className="text-xs text-red-400">Changer</button>
                        </div>
                    )}

                    <Button onClick={handleRunIDS} disabled={!idsFile} className="w-full bg-blue-600 hover:bg-blue-500">
                        <Play size={16} className="mr-2"/> Lancer l'Audit
                    </Button>
                    
                    {auditStats && auditDetails && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="mt-6 mb-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm text-slate-400">Score</span>
                                    <span className={`text-2xl font-black ${auditStats.score > 80 ? 'text-green-400' : 'text-orange-400'}`}>{auditStats.score}%</span>
                                </div>
                                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                    <div className="bg-gradient-to-r from-red-500 via-orange-400 to-green-500 h-full" style={{width: `${auditStats.score}%`}}></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {auditDetails.map((res, i) => (
                                    <div key={i} className={`p-2 rounded border-l-2 text-xs bg-slate-700/50 flex gap-2 ${res.status === 'PASS' ? 'border-green-500' : res.status === 'FAIL' ? 'border-red-500' : 'border-orange-500'}`}>
                                        <div className="mt-0.5">{res.status === 'PASS' ? <CheckCircle size={12} className="text-green-500"/> : <AlertTriangle size={12} className="text-orange-500"/>}</div>
                                        <div><div className="font-bold text-slate-200">{res.element}</div><div className="text-slate-400">{res.message}</div></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-slate-300 text-sm p-4 text-center opacity-50">
                    {selection ? `ID: ${selection}` : "Sélectionnez un élément 3D"}
                </div>
            )}
        </div>
      </div>
      {notification && <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full border border-blue-500 z-50 animate-bounce">{notification}</div>}
    </div>
  );
};

const NavButton = ({ onClick, icon, title, active }: any) => (
    <button onClick={onClick} title={title} className={`w-10 h-10 mb-2 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{icon}</button>
);

export default App;
