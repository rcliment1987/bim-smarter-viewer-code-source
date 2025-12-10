import { ShieldCheck, Play, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Panel } from "./Panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { AuditResult } from "@/types/bim";

interface AuditPanelProps {
  results: AuditResult[];
  isLoading: boolean;
  onRunAudit: () => void;
}

export function AuditPanel({ results, isLoading, onRunAudit }: AuditPanelProps) {
  return (
    <Panel title="Audit Qualité & GID" icon={ShieldCheck}>
      <div className="p-4 border-b border-border bg-secondary/30">
        <h3 className="text-sm font-semibold mb-2 text-primary">
          Règles actives
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked disabled className="data-[state=checked]:bg-primary" />
            <span>CRTI-B GID (Luxembourg)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked disabled className="data-[state=checked]:bg-primary" />
            <span>ISO 19650 Naming</span>
          </div>
        </div>
        <Button
          onClick={onRunAudit}
          disabled={isLoading}
          className="mt-4 w-full bg-[hsl(260,70%,50%)] hover:bg-[hsl(260,70%,45%)]"
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
          <div className="text-center text-muted-foreground text-xs mt-10">
            Aucun résultat d'audit.
          </div>
        )}
      </div>
    </Panel>
  );
}
