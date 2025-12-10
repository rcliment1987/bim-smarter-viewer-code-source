import { useRef } from "react";
import { ShieldCheck, Play, CheckCircle, XCircle, AlertTriangle, UploadCloud, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col h-full">
      {/* Header du Panneau */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-3 bg-secondary">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span className="font-bold tracking-wide">Audit Qualité & GID</span>
      </div>

      <div className="p-4 border-b border-border bg-secondary/30">
        <h3 className="text-sm font-semibold mb-3 text-foreground">Règles actives</h3>

        {/* INPUT CACHÉ OBLIGATOIRE */}
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".ids,.xml"
          className="hidden" 
          style={{ display: 'none' }}
        />

        {!idsFile ? (
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-2">Aucun standard chargé.</div>
            {/* BOUTON QUI DÉCLENCHE L'UPLOAD */}
            <Button 
              variant="outline" 
              className="w-full border-dashed flex gap-2 h-auto py-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-4 w-4" />
              Charger un fichier .IDS
            </Button>
          </div>
        ) : (
          <div className="mb-4 bg-background p-3 rounded border border-primary/30">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-bold truncate max-w-[150px]" title={idsFile.name}>{idsFile.name}</span>
              <Badge className="text-[10px] h-5 bg-blue-900 text-blue-100 hover:bg-blue-800">ACTIF</Badge>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <FileCode className="h-3 w-3" />
              {idsFile.ruleCount || 0} spécifications détectées
            </div>
            <button 
              onClick={onClearIDS} 
              className="mt-2 text-[10px] text-destructive hover:underline cursor-pointer"
            >
              Changer de fichier
            </button>
          </div>
        )}

        <Button 
          className="w-full gap-2" 
          disabled={!idsFile || isLoading}
          onClick={onRunAudit}
        >
          <Play className="h-4 w-4" />
          {isLoading ? "Analyse en cours..." : "Lancer l'Audit"}
        </Button>
      </div>
      
      {/* Zone de résultats */}
      <div className="flex-1 overflow-y-auto p-2">
        {results.length > 0 ? (
          <div className="space-y-2">
            {results.map((res) => (
              <div 
                key={res.id} 
                className={`p-2 rounded border text-xs flex gap-2 ${
                  res.status === 'PASS' ? 'bg-green-900/20 border-green-800 text-green-200' :
                  res.status === 'FAIL' ? 'bg-red-900/20 border-red-800 text-red-200' :
                  'bg-yellow-900/20 border-yellow-800 text-yellow-200'
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
            {idsFile ? "Prêt à auditer." : "En attente de fichier IDS."}
          </div>
        )}
      </div>
    </div>
  );
}
