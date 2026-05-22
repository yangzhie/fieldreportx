import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";

import AppHeader from "@/components/Header";
import BottomNavBar, { AppScreen } from "@/components/BottomNavBar";
import { listReportsByOrg } from "@/lib/db/reports";
import { listTemplates } from "@/lib/db/templates";
import { store } from "@/lib/store";
import { Report, Template } from "@/lib/types";

interface Props {
    onNavigate: (screen: AppScreen) => void;
    onOpenSidebar: () => void;
    hasOrganisation?: boolean;
    currentOrgId?: string | null;
}

function toMs(ts: any): number {
    if (!ts) return 0;
    if (typeof ts === "number") return ts;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (ts.seconds !== undefined) return ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6;
    return 0;
}

function timeAgo(ts: any): string {
    const ms = toMs(ts);
    if (!ms) return "";
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
}

const PALETTE = ["#8b5cf6", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#f2a72f", "#06b6d4"];
function accentColor(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return PALETTE[Math.abs(h) % PALETTE.length];
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
    draft:      { label: "Draft",       bg: "#ffff5b25", text: "#ffff5b" },
    completed:       { label: "completed",        bg: "#44ff0025", text: "#44ff00" },
    inprogress: { label: "In Progress", bg: "#44d2f925", text: "#44d2f9" },
};

type Tab = "reports" | "templates";

export default function SharedReportsScreen({ onNavigate, onOpenSidebar, hasOrganisation, currentOrgId }: Props) {
    const [tab, setTab] = useState<Tab>("reports");
    const [reports, setReports] = useState<Report[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const orgId = currentOrgId ?? store.currentOrgId;

    useEffect(() => {
        if (!orgId) { setLoadingReports(false); return; }
        setLoadingReports(true);
        listReportsByOrg(orgId)
            .then((all) => {
                all.sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
                setReports(all);
            })
            .catch((e) => console.warn("Failed to load shared reports", e))
            .finally(() => setLoadingReports(false));
    }, [orgId]);

    useEffect(() => {
        if (!orgId) { setLoadingTemplates(false); return; }
        setLoadingTemplates(true);
        listTemplates("", orgId)
            .then(setTemplates)
            .catch((e) => console.warn("Failed to load shared templates", e))
            .finally(() => setLoadingTemplates(false));
    }, [orgId]);

    const loading = tab === "reports" ? loadingReports : loadingTemplates;

    const emptyIcon = tab === "reports" ? "document-text-outline" : "albums-outline";
    const emptyText = tab === "reports" ? "No shared reports yet" : "No shared templates yet";

    return (
        <View className="flex-1 bg-background">
            <AppHeader onOpenSidebar={onOpenSidebar} onNavigate={onNavigate} active="sharedReports" />

            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                <View>
                    <Text className="text-white text-2xl font-bold">Shared</Text>
                    <Text className="text-zinc-500 text-sm mt-1">Shared with your organisation</Text>
                </View>
                {orgId && (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                            if (tab === "reports") {
                                store.setOrgReportMode(true);
                                onNavigate("reportSetup");
                            } else {
                                store.setOrgTemplateMode(true);
                                onNavigate("templateBuilder");
                            }
                        }}
                        className="flex-row items-center gap-1 bg-primary/15 rounded-xl px-3 py-2"
                    >
                        <Ionicons name="add" size={16} color="#f2a72f" />
                        <Text className="text-primary text-sm font-semibold">
                            {tab === "reports" ? "New Report" : "New Template"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Tabs */}
            <View className="flex-row mx-5 mb-3 bg-slate-900 rounded-2xl p-1">
                {(["reports", "templates"] as Tab[]).map((t) => (
                    <TouchableOpacity
                        key={t}
                        activeOpacity={0.7}
                        onPress={() => setTab(t)}
                        className={`flex-1 py-2 rounded-xl items-center ${tab === t ? "bg-primary" : ""}`}
                    >
                        <Text className={`text-sm font-semibold ${tab === t ? "text-white" : "text-zinc-500"}`}>
                            {t === "reports" ? "Reports" : "Templates"}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
                {!orgId ? (
                    <View className="items-center mt-16 gap-3">
                        <Ionicons name="business-outline" size={48} color="#3f3f46" />
                        <Text className="text-zinc-500 text-sm">No organisation selected</Text>
                    </View>
                ) : loading ? (
                    <View className="items-center mt-16">
                        <ActivityIndicator color="#f2a72f" />
                    </View>
                ) : tab === "reports" ? (
                    reports.length === 0 ? (
                        <View className="items-center mt-16 gap-3">
                            <Ionicons name={emptyIcon} size={48} color="#3f3f46" />
                            <Text className="text-zinc-500 text-sm">{emptyText}</Text>
                        </View>
                    ) : (
                        <View className="gap-3">
                            {reports.map((report) => {
                                const color = accentColor(report.templateName);
                                const cfg = STATUS_CFG[report.status] ?? STATUS_CFG.draft;
                                return (
                                    <TouchableOpacity
                                        key={report.id}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            store.setSelectedReport(report);
                                            onNavigate("reportDetail");
                                        }}
                                        className="flex-row items-center bg-slate-900 rounded-2xl overflow-hidden"
                                    >
                                        <View style={{ width: 4, alignSelf: "stretch", backgroundColor: color }} />
                                        <View className="w-10 h-10 rounded-xl m-3 items-center justify-center" style={{ backgroundColor: color + "33" }}>
                                            <Ionicons name="document-text" size={18} color={color} />
                                        </View>
                                        <View className="flex-1 py-3 pr-2">
                                            <Text className="text-white font-semibold text-sm" numberOfLines={1}>{report.title}</Text>
                                            <Text className="text-zinc-500 text-xs mt-0.5">
                                                {report.templateName} · {report.inspectorName} · {timeAgo(report.updatedAt)}
                                            </Text>
                                        </View>
                                        {report.score !== null && (
                                            <Text className="text-zinc-400 text-xs mr-2">{report.score}%</Text>
                                        )}
                                        <View className="mx-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: cfg.bg }}>
                                            <Text className="text-xs font-semibold" style={{ color: cfg.text }}>{cfg.label}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )
                ) : (
                    templates.length === 0 ? (
                        <View className="items-center mt-16 gap-3">
                            <Ionicons name={emptyIcon} size={48} color="#3f3f46" />
                            <Text className="text-zinc-500 text-sm">{emptyText}</Text>
                            <Text className="text-zinc-600 text-xs text-center">
                                When you submit a report, you can share its template with the org.
                            </Text>
                        </View>
                    ) : (
                        <View className="gap-3">
                            {templates.map((t) => {
                                const color = accentColor(t.name);
                                return (
                                    <TouchableOpacity
                                        key={t.id}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            store.setSelectedUserTemplate(t);
                                            store.setSelectedTemplate(`user_${t.id}`);
                                            onNavigate("reportSetup");
                                        }}
                                        className="flex-row items-center bg-slate-900 rounded-2xl overflow-hidden"
                                    >
                                        <View style={{ width: 4, alignSelf: "stretch", backgroundColor: color }} />
                                        <View className="w-10 h-10 rounded-xl m-3 items-center justify-center" style={{ backgroundColor: color + "33" }}>
                                            <Ionicons name="layers" size={18} color={color} />
                                        </View>
                                        <View className="flex-1 py-3 pr-2">
                                            <Text className="text-white font-semibold text-sm" numberOfLines={1}>{t.name}</Text>
                                            <Text className="text-zinc-500 text-xs mt-0.5">
                                                {t.category} · v{t.version} · {t.sections.length} sections
                                            </Text>
                                        </View>
                                        <View className="mr-3 px-2.5 py-1 rounded-full bg-primary/10">
                                            <Text className="text-primary text-xs font-semibold">Use</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )
                )}
            </ScrollView>

            <BottomNavBar active="sharedReports" onNavigate={onNavigate} hasOrganisation={hasOrganisation} />
        </View>
    );
}
