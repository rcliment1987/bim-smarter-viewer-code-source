import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MOCK_ELEMENTS } from "@/data/mockElements";
import type { PanelType, BCFTopic, AuditResult, IDSFile } from "@/types/bim";
import type { User } from "@supabase/supabase-js";

export function useBIMStore() {
  const [activePanel, setActivePanel] = useState<PanelType>("properties");
  const [selection, setSelection] = useState<string | null>(null);
  const [bcfTopics, setBcfTopics] = useState<BCFTopic[]>([]);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [idsFile, setIdsFile] = useState<IDSFile | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const selectedElement = useMemo(() => {
    return MOCK_ELEMENTS.find((el) => el.id === selection) || null;
  }, [selection]);

  // Auth state management
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch BCF topics (only when authenticated)
  useEffect(() => {
    if (!user) {
      setBcfTopics([]);
      return;
    }

    const fetchTopics = async () => {
      const { data, error } = await supabase
        .from("bcf_topics")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setBcfTopics(data as BCFTopic[]);
      }
    };

    fetchTopics();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("bcf_topics_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bcf_topics" },
        () => {
          fetchTopics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch audit results (only when authenticated)
  useEffect(() => {
    if (!user) {
      setAuditResults([]);
      return;
    }

    const fetchResults = async () => {
      const { data, error } = await supabase
        .from("audit_results")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setAuditResults(data as AuditResult[]);
      }
    };

    fetchResults();
  }, [user]);

  const addBCFTopic = async (title: string, elementId: string | null) => {
    if (!user) return false;

    const { error } = await supabase.from("bcf_topics").insert({
      title,
      element_id: elementId,
      status: "Open",
      priority: "Medium",
      assignee: "À définir",
      user_id: user.id,
    });

    return !error;
  };

  const loadIDSFile = (file: File): Promise<IDSFile> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Parse IDS XML to count specifications
        const matches = content.match(/specification/gi);
        const count = matches ? Math.ceil(matches.length / 2) : 0;
        
        const idsData: IDSFile = {
          name: file.name,
          ruleCount: count,
        };
        
        setIdsFile(idsData);
        setAuditResults([]); // Reset results when new file loaded
        resolve(idsData);
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
      reader.readAsText(file);
    });
  };

  const clearIDSFile = () => {
    setIdsFile(null);
    setAuditResults([]);
  };

  const runAudit = async () => {
    if (!idsFile || !user) return;
    
    setIsLoading(true);

    // Clear previous results for this user
    await supabase.from("audit_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Simulate audit based on loaded IDS file
    const results = [
      { element_id: "1F4a", status: "PASS", message: `Conforme à ${idsFile.name} (Règle Mur)`, rule_name: idsFile.name, user_id: user.id },
      { element_id: "2D8x", status: "PASS", message: `Conforme à ${idsFile.name} (Règle Dalle)`, rule_name: idsFile.name, user_id: user.id },
      { element_id: "9H2k", status: "FAIL", message: "Propriété 'AcousticRating' manquante (Règle Fenêtre)", rule_name: idsFile.name, user_id: user.id },
      { element_id: "4J5m", status: "WARNING", message: "Code GID (22.10) à vérifier", rule_name: idsFile.name, user_id: user.id },
    ];

    const { data, error } = await supabase
      .from("audit_results")
      .insert(results)
      .select();

    if (!error && data) {
      setAuditResults(data as AuditResult[]);
    }

    setIsLoading(false);
    setActivePanel("ids");
  };

  const exportToCSV = () => {
    const header = "GUID,Name,Type,LoadBearing,GID_Code\n";
    const rows = MOCK_ELEMENTS.map((el) => {
      const loadBearing = el.pset?.Pset_WallCommon?.LoadBearing ||
        el.pset?.Pset_SlabCommon?.LoadBearing ||
        el.pset?.Pset_ColumnCommon?.LoadBearing ||
        "N/A";
      const gidCode = el.pset?.GID_Lux?.Code || "N/A";
      return `${el.id},${el.name},${el.type},${loadBearing},${gidCode}`;
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BIMcopilot_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return {
    activePanel,
    setActivePanel,
    selection,
    setSelection,
    selectedElement,
    bcfTopics,
    auditResults,
    isLoading,
    idsFile,
    user,
    addBCFTopic,
    loadIDSFile,
    clearIDSFile,
    runAudit,
    exportToCSV,
  };
}
