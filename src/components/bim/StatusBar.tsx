interface StatusBarProps {
  selection: string | null;
}

export function StatusBar({ selection }: StatusBarProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-8 bg-background text-muted-foreground text-xs flex items-center px-4 justify-between border-t border-border">
      <span>Sélection: {selection || "Aucune"}</span>
      <div className="flex gap-4">
        <span>Coordonnées: X: 14.5 Y: 2.3 Z: 0.0</span>
        <span>Unités: Mètres</span>
      </div>
    </div>
  );
}
