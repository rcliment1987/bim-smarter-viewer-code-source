import { useRef, useState } from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { useBIMStore } from "@/hooks/useBIMStore";
import { Sidebar } from "@/components/bim/Sidebar";
import { Toolbar } from "@/components/bim/Toolbar";
import { StatusBar } from "@/components/bim/StatusBar";
import { IFCViewer } from "@/components/bim/IFCViewer";
import { PropertiesPanel } from "@/components/bim/PropertiesPanel";
import { BCFPanel } from "@/components/bim/BCFPanel";
import { AuditPanel } from "@/components/bim/AuditPanel";
import { Panel } from "@/components/bim/Panel";

export default function Index() {
  const {
    activePanel,
    setActivePanel,
    selection,
    setSelection,
    selectedElement,
    bcfTopics,
    auditResults,
    isLoading,
    idsFile,
    addBCFTopic,
    loadIDSFile,
    clearIDSFile,
    runAudit,
    exportToCSV,
  } = useBIMStore();

  // IFC file state
  const [ifcFileUrl, setIfcFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("Projet_Demo.ifc");
  const ifcInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFile = () => {
    ifcInputRef.current?.click();
  };

  const handleIfcUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      setIfcFileUrl(url);
      setSelection(null);
    }
    // Reset input
    if (ifcInputRef.current) {
      ifcInputRef.current.value = "";
    }
  };

  const handleNotification = (msg: string) => {
    toast.info(msg);
  };

  const handleExport = () => {
    exportToCSV();
    toast.success("Export Excel généré avec succès !");
  };

  const handleRunAudit = async () => {
    if (!idsFile) {
      toast.error("Veuillez d'abord charger un fichier IDS.");
      return;
    }
    toast.info(`Analyse selon "${idsFile.name}" en cours...`);
    await runAudit();
    toast.success("Audit GID terminé.");
  };

  const handleLoadIDS = async (file: File) => {
    const result = await loadIDSFile(file);
    toast.success(`Fichier IDS chargé : ${result.name}`);
    return result;
  };

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* Hidden IFC file input */}
      <input
        type="file"
        ref={ifcInputRef}
        onChange={handleIfcUpload}
        accept=".ifc"
        className="hidden"
      />

      {/* Left Sidebar */}
      <Sidebar
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        onOpenFile={handleOpenFile}
      />

      {/* Center: 3D Viewport */}
      <div className="flex-grow relative bg-secondary">
        <Toolbar onExport={handleExport} fileName={fileName} ifcLoaded={!!ifcFileUrl} />
        <IFCViewer
          ifcFileUrl={ifcFileUrl}
          selectedId={selection}
          onSelect={setSelection}
          onNotification={handleNotification}
        />
        <StatusBar selection={selection} />
      </div>

      {/* Right Sidebar: Contextual Panels */}
      <div className="w-80 bg-card border-l border-border flex flex-col shadow-xl z-20 transition-all duration-300">
        {activePanel === "properties" && (
          <PropertiesPanel element={selectedElement} />
        )}

        {activePanel === "bcf" && (
          <BCFPanel
            topics={bcfTopics}
            selectedElement={selectedElement}
            onAddTopic={addBCFTopic}
          />
        )}

        {activePanel === "ids" && (
          <AuditPanel
            results={auditResults}
            isLoading={isLoading}
            idsFile={idsFile}
            onRunAudit={handleRunAudit}
            onLoadIDS={handleLoadIDS}
            onClearIDS={clearIDSFile}
          />
        )}

        {(activePanel === "tree" || activePanel === "settings") && (
          <Panel title={activePanel === "tree" ? "Arborescence" : "Paramètres"} icon={Layers}>
            <div className="p-4 text-muted-foreground text-sm">
              Fonctionnalité en cours de développement pour la version V1.
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
