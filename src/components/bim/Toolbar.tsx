import { Ruler, Scissors, EyeOff, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ToolbarProps {
  onExport: () => void;
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}

function ToolButton({ icon, label, onClick, highlight }: ToolButtonProps) {
  return (
    <Button
      variant={highlight ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      className={highlight ? "bg-[hsl(var(--bim-success))] hover:bg-[hsl(var(--bim-success))]/90" : ""}
    >
      {icon}
      <span className="hidden xl:inline ml-2">{label}</span>
    </Button>
  );
}

export function Toolbar({ onExport }: ToolbarProps) {
  return (
    <div className="absolute top-4 left-4 right-4 h-12 glass-panel rounded-lg flex items-center px-4 justify-between z-10 shadow-lg text-sm border border-border">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-foreground">
          Projet: Residence_Lux_A.ifc
        </span>
        <Badge variant="outline" className="bg-[hsl(var(--bim-success))]/20 text-[hsl(142,76%,60%)] border-[hsl(var(--bim-success))]/50">
          IFC4
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <ToolButton
          icon={<Ruler className="w-4 h-4" />}
          label="Mesurer"
          onClick={() => toast.info("Outil Mesure activé")}
        />
        <ToolButton
          icon={<Scissors className="w-4 h-4" />}
          label="Coupe"
          onClick={() => toast.info("Plan de coupe ajouté")}
        />
        <ToolButton
          icon={<EyeOff className="w-4 h-4" />}
          label="Isoler"
          onClick={() => toast.info("Éléments non sélectionnés masqués")}
        />
        <div className="h-4 w-px bg-border mx-2" />
        <ToolButton
          icon={<FileSpreadsheet className="w-4 h-4" />}
          label="Export Excel"
          onClick={onExport}
          highlight
        />
      </div>
    </div>
  );
}
