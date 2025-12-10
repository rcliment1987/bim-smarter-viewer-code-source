import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface PanelProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}

export function Panel({ title, icon: Icon, children }: PanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card">
        <Icon className="w-5 h-5 text-primary" />
        <span className="font-bold text-foreground tracking-wide">{title}</span>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
