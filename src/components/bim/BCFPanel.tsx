import { MessageSquare, Plus, RefreshCw, Download, ChevronRight, Camera } from "lucide-react";
import { Panel } from "./Panel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { BCFTopic, BIMElement } from "@/types/bim";

interface BCFPanelProps {
  topics: BCFTopic[];
  selectedElement: BIMElement | null;
  onAddTopic: (title: string, elementId: string | null) => Promise<boolean>;
}

export function BCFPanel({ topics, selectedElement, onAddTopic }: BCFPanelProps) {
  const handleAddTopic = async () => {
    if (!selectedElement) {
      toast.warning("Sélectionnez un élément pour créer un sujet BCF.");
      return;
    }

    const title = `Problème sur ${selectedElement.name}`;
    const success = await onAddTopic(title, selectedElement.id);

    if (success) {
      toast.success("Sujet BCF créé et lié à la vue actuelle.");
    } else {
      toast.error("Erreur lors de la création du sujet.");
    }
  };

  const handleSync = () => {
    toast.info("Connexion API SharePoint... (Simulation: Sauvegarde réussie dans '/Projets/BIM/BCF')");
  };

  return (
    <Panel title="Collaboration BCF" icon={MessageSquare}>
      <div className="p-2 border-b border-border flex gap-2">
        <Button onClick={handleAddTopic} className="flex-1" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Sujet
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleSync}
          title="Sync SharePoint"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="bg-card p-3 rounded border border-border hover:border-primary cursor-pointer transition group"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="font-semibold text-foreground text-sm">
                {topic.title}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  topic.status === "Open"
                    ? "bg-[hsl(var(--bim-error))]/20 text-[hsl(0,84%,70%)]"
                    : "bg-[hsl(var(--bim-success))]/20 text-[hsl(142,76%,60%)]"
                }`}
              >
                {topic.status}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              Assigné à: {topic.assignee || "Non assigné"}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Camera className="w-3 h-3" />
                Vue sauvegardée
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            </div>
          </div>
        ))}

        {topics.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Aucun sujet BCF créé.
          </div>
        )}
      </div>

      <div className="p-3 bg-card border-t border-border">
        <Button variant="outline" className="w-full" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Exporter rapport BCF (Zip)
        </Button>
      </div>
    </Panel>
  );
}
