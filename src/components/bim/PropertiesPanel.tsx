import { Info, MousePointer2 } from "lucide-react";
import { Panel } from "./Panel";
import type { BIMElement } from "@/types/bim";

interface PropertiesPanelProps {
  element: BIMElement | null;
}

export function PropertiesPanel({ element }: PropertiesPanelProps) {
  return (
    <Panel title="Propriétés Élément" icon={Info}>
      {element ? (
        <div className="p-4 space-y-4 overflow-y-auto h-full">
          <div className="bg-card p-3 rounded border border-border">
            <div className="text-xs text-primary font-bold uppercase mb-1">
              Identification
            </div>
            <div className="text-lg font-semibold text-foreground">
              {element.name}
            </div>
            <div className="text-sm text-muted-foreground font-mono mt-1">
              GUID: {element.id}
            </div>
            <div className="text-sm text-muted-foreground">
              Type: {element.type}
            </div>
          </div>

          {Object.entries(element.pset).map(([psetName, props]) => (
            <div
              key={psetName}
              className="bg-secondary/50 rounded border border-border overflow-hidden"
            >
              <div className="bg-card px-3 py-2 text-xs font-bold text-muted-foreground border-b border-border flex justify-between items-center">
                {psetName}
                {psetName === "GID_Lux" && (
                  <span className="text-[hsl(var(--bim-warning))] text-[10px]">
                    CRTI-B
                  </span>
                )}
              </div>
              <div className="p-2 space-y-1">
                {Object.entries(props).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="text-foreground">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
          <MousePointer2 className="w-12 h-12 mb-4 opacity-50" />
          <p>
            Sélectionnez un objet dans la visionneuse 3D pour voir ses
            propriétés.
          </p>
        </div>
      )}
    </Panel>
  );
}
