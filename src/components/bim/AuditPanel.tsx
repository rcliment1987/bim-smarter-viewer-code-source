import { useRef } from "react";
import { ShieldCheck, Play, CheckCircle, XCircle, AlertTriangle, UploadCloud, FileCode } from "lucide-react";
import { Panel } from "./Panel";
import { Button } from "@/components/ui/button";
import type { AuditResult, IDSFile } from "@/types/bim";

interface AuditPanelProps {
  results: AuditResult[];
  isLoading: boolean;
  idsFile: IDSFile | null;
  onRunAudit: () => void;
  onLoadIDS: (file: File) => Promise<IDSFile>;
  onClearIDS: () => void;
}

export function AuditPanel({ 
  results, 
  isLoading, 
  idsFile, 
  onRunAudit, 
  onLoadIDS, 
  onClearIDS 
}: AuditPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    await onLoadIDS(file);
    
    // Reset input to allow re-selecting same file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Panel title="Audit Qualité & GID" icon={ShieldCheck}>
      <div className="p-4 border-b border-border bg-secondary/30">
        <h3 className="text-sm font-semibold mb-2 text-primary">
          Règles actives
        </h3>
        
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".ids,.xml"
          className="hidden"
        />

        {!idsFile ? (
          // State 1: No file loaded
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-2">Aucun standard chargé.</div>
            <Button
              variant="outline"
              onClick={handleTriggerUpload}
              className="w-full border-dashed"
            >
              <UploadCloud className="w-4 h-4 mr-2" />
              Charger un fichier .IDS
            </Button>
          </div>
        ) : (
          // State 2: File loaded
          <div className="mb-4 bg-secondary p-3 rounded border border-primary/30">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-bold text-foreground truncate max-w-[150px]" title={idsFile.name}>
                {idsFile.name}
              </span>
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded font-medium">
                ACTIF
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <FileCode className="w-3 h-3" />
              {idsFile.ruleCount > 0 
                ? `${idsFile.ruleCount} spécifications détectées` 
                : "Format standard détecté"}
            </div>
            <button
              onClick={onClearIDS}
              className="mt-2 text-[10px] text-destructive hover:underline"
            >
              Changer de fichier
            </button>
          </div>
        )}

        <Button
          onClick={onRunAudit}
          disabled={isLoading || !idsFile}
          className="w-full"
          variant={idsFile ? "default" : "secondary"}
        >
          <Play className="w-4 h-4 mr-2" />
          {isLoading ? "Analyse en cours..." : "Lancer l'Audit"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {results.length > 0 ? (
          <div className="space-y-2">
            {results.map((res) => (
              <div
                key={res.id}
                className={`p-2 rounded border text-xs flex gap-2 ${
                  res.status === "PASS"
                    ? "bg-[hsl(var(--bim-success))]/10 border-[hsl(var(--bim-success))]/50 text-[hsl(142,76%,60%)]"
                    : res.status === "FAIL"
                    ? "bg-[hsl(var(--bim-error))]/10 border-[hsl(var(--bim-error))]/50 text-[hsl(0,84%,70%)]"
                    : "bg-[hsl(var(--bim-warning))]/10 border-[hsl(var(--bim-warning))]/50 text-[hsl(45,93%,60%)]"
                }`}
              >
                <div className="mt-0.5">
                  {res.status === "PASS" && <CheckCircle className="w-4 h-4" />}
                  {res.status === "FAIL" && <XCircle className="w-4 h-4" />}
                  {res.status === "WARNING" && <AlertTriangle className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold">{res.element_id}</div>
                  <div className="opacity-80">{res.message}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-xs mt-10 px-4">
            {idsFile 
              ? "Prêt à auditer la maquette selon les règles du fichier chargé."
              : "Chargez un fichier IDS (XML) pour commencer l'analyse."}
          </div>
        )}
      </div>
    </Panel>
  );
}
