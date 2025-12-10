import { Layers } from "lucide-react";
import { toast } from "sonner";
import { useBIMStore } from "@/hooks/useBIMStore";
import { Sidebar } from "@/components/bim/Sidebar";
import { Toolbar } from "@/components/bim/Toolbar";
import { StatusBar } from "@/components/bim/StatusBar";
import { ThreeViewer } from "@/components/bim/ThreeViewer";
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
    addBCFTopic,
    runAudit,
    exportToCSV,
  } = useBIMStore();

  const handleOpenFile = () => {
    toast.info("Module chargement IFC (WASM) désactivé en mode démo.");
  };

  const handleExport = () => {
    exportToCSV();
    toast.success("Export Excel généré avec succès !");
  };

  const handleRunAudit = async () => {
    toast.info("Analyse IDS (Luxembourg CRTI-B) en cours...");
    await runAudit();
    toast.success("Audit GID terminé.");
  };

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        onOpenFile={handleOpenFile}
      />

      {/* Center: 3D Viewport */}
      <div className="flex-grow relative bg-secondary">
        <Toolbar onExport={handleExport} />
        <ThreeViewer selectedId={selection} onSelect={setSelection} />
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
            onRunAudit={handleRunAudit}
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
