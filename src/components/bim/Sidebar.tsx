import { 
  FolderOpen, 
  Layers, 
  Info, 
  MessageSquare, 
  ShieldCheck, 
  Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PanelType } from "@/types/bim";

interface SidebarProps {
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
  onOpenFile: () => void;
}

interface NavButtonProps {
  icon: React.ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
}

function NavButton({ icon, title, active, onClick }: NavButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(
            "w-10 h-10 mb-2 transition-all duration-200",
            active
              ? "bg-primary text-primary-foreground shadow-lg"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ activePanel, onPanelChange, onOpenFile }: SidebarProps) {
  return (
    <div className="w-16 flex flex-col items-center py-4 bg-background border-r border-border z-10">
      <div className="mb-6 font-bold text-xl text-primary tracking-tighter">
        BIM
      </div>

      <NavButton
        icon={<FolderOpen className="w-5 h-5" />}
        title="Ouvrir IFC (Local)"
        active={false}
        onClick={onOpenFile}
      />

      <div className="h-px w-8 bg-border my-2" />

      <NavButton
        icon={<Layers className="w-5 h-5" />}
        title="Arborescence"
        active={activePanel === "tree"}
        onClick={() => onPanelChange("tree")}
      />
      <NavButton
        icon={<Info className="w-5 h-5" />}
        title="Propriétés"
        active={activePanel === "properties"}
        onClick={() => onPanelChange("properties")}
      />
      <NavButton
        icon={<MessageSquare className="w-5 h-5" />}
        title="BCF Collaboration"
        active={activePanel === "bcf"}
        onClick={() => onPanelChange("bcf")}
      />
      <NavButton
        icon={<ShieldCheck className="w-5 h-5" />}
        title="Audit GID/IDS"
        active={activePanel === "ids"}
        onClick={() => onPanelChange("ids")}
      />

      <div className="flex-grow" />

      <NavButton
        icon={<Settings className="w-5 h-5" />}
        title="Paramètres"
        active={activePanel === "settings"}
        onClick={() => onPanelChange("settings")}
      />
    </div>
  );
}
