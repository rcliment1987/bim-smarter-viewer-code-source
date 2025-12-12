import React, { useState, useRef, useCallback } from 'react';
import { ThreeViewer, SelectedElementInfo } from './components/ThreeViewer';
import { FolderOpen, Info, ShieldCheck, UploadCloud, Play, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, Box, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseIDS, IDSFile } from './lib/IDSParser';
import { IDSAuditEngine, AuditSummary, AuditResult } from './lib/IDSAuditEngine';

// Store IFC API reference for audit
let globalIfcApi: any = null;
let globalModelID: number | null = null;

// Export function to set IFC API from ThreeViewer
export const setIfcApiForAudit = (api: any, modelID: number) => {
  globalIfcApi = api;
  globalModelID = modelID;
};

const App = () => {
  const [activePanel, setActivePanel] = useState('properties');
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  
  // IDS State
  const [idsFile, setIdsFile] = useState<IDSFile | null>(null);
  const [idsFileName, setIdsFileName] = useState<string>('');
  const [idsError, setIdsError] = useState<string | null>(null);
  
  // IFC State
  const [ifcFileUrl, setIfcFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("Projet_Demo.ifc");
  
  // Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState<string>('');
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'PASS' | 'FAIL' | 'WARNING'>('all');
  
  // Properties panel state
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set(['Informations générales']));

  const idsInputRef = useRef<HTMLInputElement>(null);
  const ifcInputRef = useRef<HTMLInputElement>(null);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleSelection = useCallback((info: SelectedElementInfo | null) => {
    setSelectedElement(info);
    if (info) {
      setActivePanel('properties');
      const allSets = new Set(info.propertySets.map(ps => ps.name));
      setExpandedSets(allSets);
    }
  }, []);

  const togglePropertySet = (name: string) => {
    setExpandedSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) newSet.delete(name);
      else newSet.add(name);
      return newSet;
    });
  };

  const toggleSpec = (name: string) => {
    setExpandedSpecs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) newSet.delete(name);
      else newSet.add(name);
      return newSet;
    });
  };

  const handleIfcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setIfcFileUrl(URL.createObjectURL(file));
      setAuditSummary(null);
      setSelectedElement(null);
    }
  };

  const handleIdsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdsError(null);
      setIdsFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target?.result as string;
          const parsed = parseIDS(content);
          setIdsFile(parsed);
          showNotification(`IDS chargé: ${parsed.specifications.length} spécification(s)`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Erreur de parsing';
          setIdsError(errorMsg);
          setIdsFile(null);
          showNotification(`Erreur IDS: ${errorMsg}`);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleRunAudit = async () => {
    if (!idsFile || !globalIfcApi || globalModelID === null) {
      showNotification("Veuillez charger un fichier IFC et un fichier IDS");
      return;
    }

    setIsAuditing(true);
    setAuditProgress('Initialisation...');
    setAuditSummary(null);

    try {
      const engine = new IDSAuditEngine(globalIfcApi, globalModelID);
      
      const summary = await engine.runAudit(idsFile, (message, percent) => {
        setAuditProgress(`${message} (${Math.round(percent)}%)`);
      });

      setAuditSummary(summary);
      setActivePanel('ids');
      
      // Expand all specs with failures
      const failedSpecs = new Set<string>();
      summary.results.filter(r => r.status === 'FAIL').forEach(r => failedSpecs.add(r.specificationName));
      setExpandedSpecs(failedSpecs);
      
      showNotification(`Audit terminé: ${summary.score}% de conformité`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      showNotification(`Erreur d'audit: ${errorMsg}`);
    } finally {
      setIsAuditing(false);
      setAuditProgress('');
    }
  };

  const formatValue = (value: string | number | boolean | null): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return value.toString();
      return value.toFixed(3);
    }
    return String(value);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS': return <CheckCircle size={14} className="text-green-500" />;
      case 'FAIL': return <XCircle size={14} className="text-red-500" />;
      case 'WARNING': return <AlertTriangle size={14} className="text-orange-500" />;
      default: return <Info size={14} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASS': return 'border-green-500 bg-green-500/10';
      case 'FAIL': return 'border-red-500 bg-red-500/10';
      case 'WARNING': return 'border-orange-500 bg-orange-500/10';
      default: return 'border-gray-500 bg-gray-500/10';
    }
  };

  // Group results by specification
  const groupedResults = auditSummary?.results.reduce((acc, result) => {
    const key = result.specificationName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {} as Record<string, AuditResult[]>) || {};

  // Filter results
  const filteredGroupedResults = Object.entries(groupedResults).reduce((acc, [spec, results]) => {
    const filtered = filterStatus === 'all' ? results : results.filter(r => r.status === filterStatus);
    if (filtered.length > 0) acc[spec] = filtered;
    return acc;
  }, {} as Record<string, AuditResult[]>);

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
        <NavButton active={activePanel === 'ids'} onClick={() => setActivePanel('ids')} icon={<ShieldCheck size={20} />} title="Audit IDS" />
      </div>

      {/* CENTRE */}
      <div className="flex-grow relative bg-gray-200">
        <div className="absolute top-4 left-4 right-4 h-12 flex items-center px-4 justify-between z-10 shadow-lg text-sm border border-slate-600 bg-slate-800/90 backdrop-blur rounded-lg">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">{fileName}</span>
            {ifcFileUrl && <span className="text-[10px] bg-blue-900 px-2 py-0.5 rounded text-blue-200 font-bold">IFC</span>}
            {idsFile && <span className="text-[10px] bg-purple-900 px-2 py-0.5 rounded text-purple-200 font-bold">IDS</span>}
          </div>
          <div className="flex items-center text-slate-300 gap-2"><FileSpreadsheet size={16}/> Export</div>
        </div>
        <ThreeViewer ifcFileUrl={ifcFileUrl} onSelect={handleSelection} setNotification={showNotification} />
      </div>

      {/* SIDEBAR DROITE */}
      <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col shadow-xl z-20">
        <div className="h-14 border-b border-slate-700 flex items-center px-4 gap-3 bg-slate-800">
          {activePanel === 'ids' ? <ShieldCheck className="text-purple-500" size={20} /> : <Info className="text-blue-500" size={20} />}
          <span className="font-bold text-white tracking-wide">{activePanel === 'ids' ? 'Audit IDS' : 'Propriétés IFC'}</span>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          {activePanel === 'ids' ? (
            <div className="space-y-4">
              {/* IDS File Upload */}
              {!idsFile ? (
                <div>
                  <Button variant="outline" onClick={() => idsInputRef.current?.click()} className="w-full h-20 border-dashed border-slate-600 flex flex-col gap-2 hover:border-purple-500 hover:bg-purple-500/10">
                    <UploadCloud size={24} /> Charger fichier IDS (.ids)
                  </Button>
                  {idsError && (
                    <div className="mt-2 p-2 bg-red-500/20 border border-red-500 rounded text-xs text-red-300">
                      {idsError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-700 p-3 rounded border border-purple-500/50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={16} className="text-purple-400" />
                        <span className="font-bold text-white text-sm">{idsFile.title}</span>
                      </div>
                      <div className="text-xs text-slate-400">{idsFileName}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {idsFile.specifications.length} spécification(s)
                        {idsFile.version && ` • v${idsFile.version}`}
                      </div>
                      {idsFile.purpose && (
                        <div className="text-xs text-slate-500 mt-1 italic">{idsFile.purpose}</div>
                      )}
                    </div>
                    <button onClick={() => { setIdsFile(null); setAuditSummary(null); }} className="text-xs text-red-400 hover:text-red-300">✕</button>
                  </div>
                </div>
              )}

              {/* Run Audit Button */}
              <Button 
                onClick={handleRunAudit} 
                disabled={!idsFile || !ifcFileUrl || isAuditing} 
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
              >
                {isAuditing ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    {auditProgress || 'Audit en cours...'}
                  </>
                ) : (
                  <>
                    <Play size={16} className="mr-2" />
                    Lancer l'Audit
                  </>
                )}
              </Button>

              {!ifcFileUrl && idsFile && (
                <div className="text-xs text-orange-400 text-center">
                  ⚠️ Chargez un fichier IFC pour lancer l'audit
                </div>
              )}

              {/* Audit Results */}
              {auditSummary && (
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                  {/* Score Card */}
                  <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-sm text-slate-400">Score de conformité</span>
                      <span className={`text-3xl font-black ${auditSummary.score >= 80 ? 'text-green-400' : auditSummary.score >= 50 ? 'text-orange-400' : 'text-red-400'}`}>
                        {auditSummary.score}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden mb-3">
                      <div 
                        className={`h-full transition-all duration-500 ${auditSummary.score >= 80 ? 'bg-green-500' : auditSummary.score >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                        style={{ width: `${auditSummary.score}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-green-500/20 rounded p-2">
                        <div className="text-green-400 font-bold text-lg">{auditSummary.pass}</div>
                        <div className="text-green-300">PASS</div>
                      </div>
                      <div className="bg-red-500/20 rounded p-2">
                        <div className="text-red-400 font-bold text-lg">{auditSummary.fail}</div>
                        <div className="text-red-300">FAIL</div>
                      </div>
                      <div className="bg-orange-500/20 rounded p-2">
                        <div className="text-orange-400 font-bold text-lg">{auditSummary.warning}</div>
                        <div className="text-orange-300">WARN</div>
                      </div>
                      <div className="bg-slate-600/50 rounded p-2">
                        <div className="text-slate-300 font-bold text-lg">{auditSummary.testedElements}</div>
                        <div className="text-slate-400">Éléments</div>
                      </div>
                    </div>
                  </div>

                  {/* Filter Buttons */}
                  <div className="flex gap-1">
                    {(['all', 'FAIL', 'WARNING', 'PASS'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
                          filterStatus === status 
                            ? 'bg-slate-600 text-white' 
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {status === 'all' ? 'Tous' : status}
                      </button>
                    ))}
                  </div>

                  {/* Results by Specification */}
                  <div className="space-y-2">
                    {Object.entries(filteredGroupedResults).map(([specName, results]) => {
                      const passCount = results.filter(r => r.status === 'PASS').length;
                      const failCount = results.filter(r => r.status === 'FAIL').length;
                      const isExpanded = expandedSpecs.has(specName);

                      return (
                        <div key={specName} className="bg-slate-700/50 rounded-lg overflow-hidden border border-slate-600">
                          <button
                            onClick={() => toggleSpec(specName)}
                            className="w-full px-3 py-2 flex items-center justify-between bg-slate-700 hover:bg-slate-600 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span className="font-medium text-sm text-slate-200 text-left">{specName}</span>
                            </div>
                            <div className="flex gap-1 text-xs">
                              {passCount > 0 && <span className="bg-green-500/30 text-green-300 px-1.5 rounded">{passCount}</span>}
                              {failCount > 0 && <span className="bg-red-500/30 text-red-300 px-1.5 rounded">{failCount}</span>}
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                              {results.map((result, idx) => (
                                <div 
                                  key={idx} 
                                  className={`p-2 rounded border-l-2 text-xs ${getStatusColor(result.status)}`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="mt-0.5">{getStatusIcon(result.status)}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-slate-200 truncate" title={result.elementName}>
                                        {result.elementName}
                                      </div>
                                      <div className="text-slate-400 text-[10px]">{result.elementType} #{result.elementId}</div>
                                      <div className="text-slate-300 mt-1">{result.requirementDescription}</div>
                                      <div className={`mt-1 ${result.status === 'PASS' ? 'text-green-300' : result.status === 'FAIL' ? 'text-red-300' : 'text-orange-300'}`}>
                                        {result.message}
                                      </div>
                                      {result.details && (
                                        <div className="text-slate-500 mt-0.5 text-[10px]">{result.details}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {Object.keys(filteredGroupedResults).length === 0 && (
                    <div className="text-center text-slate-500 py-4">
                      Aucun résultat pour ce filtre
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* PROPERTIES PANEL */
            <div className="space-y-3">
              {selectedElement ? (
                <>
                  <div className="bg-gradient-to-r from-green-600 to-green-500 p-3 rounded-lg shadow-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Box size={18} className="text-white" />
                      <span className="font-bold text-white text-sm">{selectedElement.name}</span>
                    </div>
                    <div className="text-green-100 text-xs">{selectedElement.type}</div>
                    <div className="text-green-200 text-[10px] mt-1">ID: {selectedElement.expressID}</div>
                  </div>

                  {selectedElement.propertySets.map((pset, index) => (
                    <div key={index} className="bg-slate-700/50 rounded-lg overflow-hidden border border-slate-600">
                      <button
                        onClick={() => togglePropertySet(pset.name)}
                        className="w-full px-3 py-2 flex items-center justify-between bg-slate-700 hover:bg-slate-600 transition-colors"
                      >
                        <span className="font-semibold text-sm text-slate-200">{pset.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{pset.properties.length}</span>
                          {expandedSets.has(pset.name) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </button>
                      
                      {expandedSets.has(pset.name) && (
                        <div className="p-2 space-y-1">
                          {pset.properties.map((prop, propIndex) => (
                            <div key={propIndex} className="flex justify-between items-start py-1 px-2 hover:bg-slate-600/50 rounded text-xs">
                              <span className="text-slate-400 flex-shrink-0 mr-2">{prop.name}</span>
                              <span className="text-slate-200 text-right font-mono break-all">{formatValue(prop.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="text-center text-xs text-slate-500 mt-4">
                    {selectedElement.propertySets.reduce((acc, ps) => acc + ps.properties.length, 0)} propriétés
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Box size={48} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 text-sm">Cliquez sur un élément 3D</p>
                  <p className="text-slate-500 text-xs mt-1">pour voir ses propriétés IFC</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {notification && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full border border-purple-500 z-50 shadow-lg">
          {notification}
        </div>
      )}
    </div>
  );
};

const NavButton = ({ onClick, icon, title, active }: any) => (
  <button onClick={onClick} title={title} className={`w-10 h-10 mb-2 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
    {icon}
  </button>
);

export default App;
