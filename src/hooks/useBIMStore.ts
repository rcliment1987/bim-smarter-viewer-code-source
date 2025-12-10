import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MOCK_ELEMENTS } from "@/data/mockElements";
import type { PanelType, BCFTopic, AuditResult, BIMElement } from "@/types/bim";

export function useBIMStore() {
  const [activePanel, setActivePanel] = useState<PanelType>("properties");
  const [selection, setSelection] = useState<string | null>(null);
  const [bcfTopics, setBcfTopics] = useState<BCFTopic[]>([]);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedElement = useMemo(() => {
    return MOCK_ELEMENTS.find((el) => el.id === selection) || null;
  }, [selection]);

  // Fetch BCF topics
  useEffect(() => {
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
  }, []);

  // Fetch audit results
  useEffect(() => {
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
  }, []);

  const addBCFTopic = async (title: string, elementId: string | null) => {
    const { error } = await supabase.from("bcf_topics").insert({
      title,
      element_id: elementId,
      status: "Open",
      priority: "Medium",
      assignee: "À définir",
    });

    return !error;
  };

  const runAudit = async () => {
    setIsLoading(true);

    // Clear previous results
    await supabase.from("audit_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Simulate audit
    const results: Omit<AuditResult, "id" | "created_at">[] = [
      { element_id: "1F4a", status: "PASS", message: "Code GID présent (21.12)", rule_name: "CRTI-B GID" },
      { element_id: "2D8x", status: "PASS", message: "Code GID présent (23.01)", rule_name: "CRTI-B GID" },
      { element_id: "9H2k", status: "FAIL", message: "Propriété 'AcousticRating' manquante pour chassis ext.", rule_name: "ISO 19650" },
      { element_id: "4J5m", status: "WARNING", message: "Code GID (22.10) à vérifier avec Pset_Concrete", rule_name: "CRTI-B GID" },
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
    addBCFTopic,
    runAudit,
    exportToCSV,
  };
}
