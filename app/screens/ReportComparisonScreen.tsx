import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { AppScreen } from "@/components/BottomNavBar";
import { store } from "@/lib/store";
import { Report, SectionStatus } from "@/lib/types";

interface Props {
    onNavigate: (screen: AppScreen) => void;
    hasOrganisation?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_A = "#f2a72f";
const COLOR_B = "#8b5cf6";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: any): string {
    if (!ts) return "—";
    const ms = typeof ts?.toMillis === "function"
        ? ts.toMillis()
        : (ts?.seconds ?? 0) * 1000;
    if (!ms) return "—";
    return new Date(ms).toLocaleDateString("en-AU", {
        day: "numeric", month: "short", year: "numeric",
    });
}

const STATUS_SCORE: Record<SectionStatus, number> = {
    completed: 4, partial: 3, inprogress: 2, skipped: 1, notstarted: 0,
};

const STATUS_LABEL: Record<SectionStatus, string> = {
    completed: "completed", partial: "Partial", inprogress: "In Progress",
    skipped: "Skipped", notstarted: "—",
};

const STATUS_COLOR: Record<SectionStatus, string> = {
    completed: "#22c55e", partial: "#f59e0b", inprogress: "#3b82f6",
    skipped: "#71717a", notstarted: "#3f3f46",
};

type DiffType = "better" | "worse" | "same";

const DIFF_STYLE: Record<DiffType, { color: string; icon: "arrow-up" | "arrow-down" | "remove" }> = {
    better: { color: "#22c55e", icon: "arrow-up" },
    worse:  { color: "#ef4444", icon: "arrow-down" },
    same:   { color: "#52525b", icon: "remove" },
};

interface SectionRow {
    name: string;
    statusA: SectionStatus | null;
    statusB: SectionStatus | null;
    diff: DiffType;
}

function buildSectionRows(a: Report, b: Report): SectionRow[] {
    const seen = new Set<string>();
    const names: string[] = [];
    [...a.sections, ...b.sections].forEach((s) => {
        if (!seen.has(s.name)) { seen.add(s.name); names.push(s.name); }
    });
    return names.map((name) => {
        const secA = a.sections.find((s) => s.name === name) ?? null;
        const secB = b.sections.find((s) => s.name === name) ?? null;
        const sA = STATUS_SCORE[secA?.status ?? "notstarted"];
        const sB = STATUS_SCORE[secB?.status ?? "notstarted"];
        return {
            name,
            statusA: secA?.status ?? null,
            statusB: secB?.status ?? null,
            diff: sA > sB ? "better" : sA < sB ? "worse" : "same",
        };
    });
}

function completedCount(r: Report): number {
    return r.sections.filter((s) => s.status === "completed" || s.status === "partial").length;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ value, label, color }: { value: number; label: string; color: string }) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: color + "18",
                borderRadius: 16,
                padding: 12,
                borderWidth: 1,
                borderColor: color + "30",
            }}
        >
            <Text style={{ color, fontSize: 22, fontWeight: "800" }}>{value}</Text>
            <Text style={{ color, fontSize: 11, marginTop: 2 }}>{label}</Text>
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportComparisonScreen({ onNavigate }: Props) {
    const pair = store.comparisonReports;
    const [activeTab, setActiveTab] = useState<"sections" | "summary">("sections");

    if (!pair) {
        return (
            <View className="flex-1 bg-background items-center justify-center px-8">
                <Ionicons name="git-compare-outline" size={40} color="#52525b" />
                <Text className="text-zinc-400 text-sm mt-3 text-center">
                    No reports selected. Go back and long-press two reports to compare.
                </Text>
                <TouchableOpacity
                    onPress={() => onNavigate("reports")}
                    className="mt-5 bg-primary px-6 py-3 rounded-xl"
                >
                    <Text className="text-white font-semibold text-sm">Go to Reports</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const [reportA, reportB] = pair;
    const rows = buildSectionRows(reportA, reportB);

    const improved = rows.filter((r) => r.diff === "better").length;
    const declined = rows.filter((r) => r.diff === "worse").length;
    const unchanged = rows.filter((r) => r.diff === "same").length;

    const scoreA = reportA.score;
    const scoreB = reportB.score;
    const bothHaveScores = scoreA !== null && scoreB !== null;
    const scoreDelta = bothHaveScores ? scoreA - scoreB : null;

    const completedA = completedCount(reportA);
    const completedB = completedCount(reportB);

    const photosA = reportA.photos?.length ?? 0;
    const photosB = reportB.photos?.length ?? 0;

    const distA = reportA.routeData?.distanceKm ?? null;
    const distB = reportB.routeData?.distanceKm ?? null;

    const keyChanges = rows
        .filter((r) => r.diff !== "same")
        .map((r) => {
            const labelA = r.statusA ? STATUS_LABEL[r.statusA] : "—";
            const labelB = r.statusB ? STATUS_LABEL[r.statusB] : "—";
            return r.diff === "better"
                ? { icon: "arrow-up-circle" as const, color: "#22c55e", text: `${r.name}: ${labelB} → ${labelA}` }
                : { icon: "arrow-down-circle" as const, color: "#ef4444", text: `${r.name}: ${labelA} → ${labelB}` };
        });

    const statRows = [
        {
            icon: "checkmark-circle-outline" as const,
            label: "Sections completed",
            valA: `${completedA}/${reportA.sections.length}`,
            valB: `${completedB}/${reportB.sections.length}`,
            winA: completedA > completedB,
            winB: completedB > completedA,
        },
        {
            icon: "images-outline" as const,
            label: "Photos taken",
            valA: String(photosA),
            valB: String(photosB),
            winA: photosA > photosB,
            winB: photosB > photosA,
        },
        ...(distA !== null || distB !== null ? [{
            icon: "navigate-outline" as const,
            label: "Route distance",
            valA: distA !== null ? `${distA.toFixed(2)} km` : "—",
            valB: distB !== null ? `${distB.toFixed(2)} km` : "—",
            winA: false,
            winB: false,
        }] : []),
    ];

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View className="flex-row items-center gap-3 px-5 pt-16 pb-4">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onNavigate("reports")}
                    className="w-9 h-9 items-center justify-center rounded-full bg-slate-800"
                >
                    <Ionicons name="arrow-back" size={18} color="#ffffff" />
                </TouchableOpacity>
                <Text className="text-white text-lg font-bold">Compare Reports</Text>
            </View>

            {/* Report Header Cards */}
            <View className="flex-row mx-5 gap-2 mb-4">
                {([reportA, reportB] as const).map((rep, i) => {
                    const color = i === 0 ? COLOR_A : COLOR_B;
                    return (
                        <View
                            key={rep.id}
                            style={{
                                flex: 1,
                                backgroundColor: "#1e293b",
                                borderRadius: 16,
                                padding: 12,
                                borderTopWidth: 3,
                                borderTopColor: color,
                            }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                                <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{i === 0 ? "A" : "B"}</Text>
                            </View>
                            <Text className="text-white text-xs font-bold" numberOfLines={1}>{rep.title}</Text>
                            <Text className="text-zinc-500 text-xs mt-0.5" numberOfLines={1}>{rep.templateName}</Text>
                            <Text className="text-zinc-600 text-xs">{fmtDate(rep.updatedAt)}</Text>
                            {rep.score !== null ? (
                                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 4 }}>
                                    <Text style={{ color, fontSize: 22, fontWeight: "800" }}>{rep.score}</Text>
                                    <Text className="text-zinc-500 text-xs">/100</Text>
                                </View>
                            ) : (
                                <Text className="text-zinc-500 text-xs mt-1 capitalize">{rep.status}</Text>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Tab Toggle */}
            <View className="flex-row bg-slate-900 rounded-2xl mx-5 p-1 mb-4">
                {(["sections", "summary"] as const).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        activeOpacity={0.7}
                        onPress={() => setActiveTab(tab)}
                        className={`flex-1 py-2 rounded-xl items-center ${activeTab === tab ? "bg-zinc-700" : ""}`}
                    >
                        <Text className={`text-sm font-medium capitalize ${activeTab === tab ? "text-white" : "text-zinc-500"}`}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeTab === "sections" ? (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                >
                    {/* Column headers */}
                    <View className="flex-row mb-2 px-1">
                        <Text className="text-zinc-600 text-xs flex-1">Section</Text>
                        <Text style={{ color: COLOR_A + "aa", width: 80, textAlign: "center", fontSize: 11, fontWeight: "700" }}>A</Text>
                        <Text className="text-zinc-600 text-xs w-6" />
                        <Text style={{ color: COLOR_B + "aa", width: 80, textAlign: "center", fontSize: 11, fontWeight: "700" }}>B</Text>
                    </View>

                    <View className="bg-slate-900 rounded-2xl overflow-hidden">
                        {rows.length === 0 ? (
                            <Text className="text-zinc-600 text-sm text-center py-6">No sections to compare.</Text>
                        ) : rows.map((row, i) => {
                            const ds = DIFF_STYLE[row.diff];
                            const colorA = row.statusA ? STATUS_COLOR[row.statusA] : "#3f3f46";
                            const colorB = row.statusB ? STATUS_COLOR[row.statusB] : "#3f3f46";
                            const labelA = row.statusA ? STATUS_LABEL[row.statusA] : "—";
                            const labelB = row.statusB ? STATUS_LABEL[row.statusB] : "—";
                            return (
                                <View
                                    key={row.name}
                                    className={`flex-row items-center px-4 py-3 ${i < rows.length - 1 ? "border-b border-zinc-800" : ""}`}
                                >
                                    <Text className="text-white text-sm flex-1" numberOfLines={1}>{row.name}</Text>
                                    <Text style={{ color: colorA, width: 80, textAlign: "center", fontSize: 12, fontWeight: "600" }}>
                                        {labelA}
                                    </Text>
                                    <View className="w-6 items-center">
                                        <Ionicons name={ds.icon} size={12} color={ds.color} />
                                    </View>
                                    <Text style={{ color: colorB, width: 80, textAlign: "center", fontSize: 12, fontWeight: "600" }}>
                                        {labelB}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                >
                    {/* Improved / Declined / Unchanged tiles */}
                    <View className="flex-row gap-2 mb-4">
                        <StatTile value={improved} label="Improved" color="#22c55e" />
                        <StatTile value={declined} label="Declined" color="#ef4444" />
                        <StatTile value={unchanged} label="Unchanged" color="#52525b" />
                    </View>

                    {/* Score delta card */}
                    {bothHaveScores && scoreDelta !== null && (
                        <View className="bg-slate-900 rounded-2xl p-4 mb-4">
                            <Text className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-4">
                                Score
                            </Text>
                            <View className="flex-row items-center justify-between">
                                <View className="items-center">
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_B, marginBottom: 4 }} />
                                    <Text className="text-zinc-500 text-xs mb-1">B</Text>
                                    <Text className="text-white text-3xl font-bold">{scoreB}</Text>
                                </View>
                                <View className="items-center gap-1">
                                    <Ionicons name="arrow-forward" size={20} color="#f2a72f" />
                                    <View
                                        style={{
                                            backgroundColor: scoreDelta > 0 ? "#22c55e20" : scoreDelta < 0 ? "#ef444420" : "#71717a20",
                                            borderRadius: 20,
                                            paddingHorizontal: 10,
                                            paddingVertical: 3,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: scoreDelta > 0 ? "#22c55e" : scoreDelta < 0 ? "#ef4444" : "#71717a",
                                                fontWeight: "700",
                                                fontSize: 13,
                                            }}
                                        >
                                            {scoreDelta > 0 ? "+" : ""}{scoreDelta}
                                        </Text>
                                    </View>
                                </View>
                                <View className="items-center">
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_A, marginBottom: 4 }} />
                                    <Text className="text-zinc-500 text-xs mb-1">A</Text>
                                    <Text className="text-white text-3xl font-bold">{scoreA}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Stats grid */}
                    <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2">
                        Stats
                    </Text>
                    <View className="bg-slate-900 rounded-2xl overflow-hidden mb-4">
                        {statRows.map((stat, i) => (
                            <View
                                key={stat.label}
                                className={`flex-row items-center px-4 py-3.5 ${i < statRows.length - 1 ? "border-b border-zinc-800" : ""}`}
                            >
                                <Ionicons name={stat.icon} size={16} color="#52525b" />
                                <Text className="text-zinc-400 text-sm ml-3 flex-1">{stat.label}</Text>
                                <Text style={{ color: stat.winA ? COLOR_A : "#9ca3af", width: 56, textAlign: "center", fontWeight: "600", fontSize: 13 }}>
                                    {stat.valA}
                                </Text>
                                <Text className="text-zinc-700 text-xs mx-1">vs</Text>
                                <Text style={{ color: stat.winB ? COLOR_B : "#9ca3af", width: 56, textAlign: "center", fontWeight: "600", fontSize: 13 }}>
                                    {stat.valB}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Key changes */}
                    <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2">
                        Key changes (A vs B)
                    </Text>
                    {keyChanges.length > 0 ? (
                        <View className="bg-slate-900 rounded-2xl overflow-hidden">
                            {keyChanges.map((item, i) => (
                                <View
                                    key={i}
                                    className={`flex-row items-center gap-3 px-4 py-3.5 ${i < keyChanges.length - 1 ? "border-b border-zinc-800" : ""}`}
                                >
                                    <Ionicons name={item.icon} size={18} color={item.color} />
                                    <Text className="text-white text-sm flex-1">{item.text}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View className="bg-slate-900 rounded-2xl px-4 py-5 items-center">
                            <Ionicons name="checkmark-completed-outline" size={24} color="#22c55e" />
                            <Text className="text-zinc-400 text-sm mt-2 text-center">
                                All sections have the same status across both reports.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}
