import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import AppHeader from "@/components/Header";
import BottomNavBar, { AppScreen } from "@/components/BottomNavBar";
import { useAuth } from "@/hooks/useAuth";
import { listReportsByUser } from "@/lib/db/reports";
import { store } from "@/lib/store";
import { Report } from "@/lib/types";

interface Props {
    onNavigate: (screen: AppScreen) => void;
    onOpenSidebar: () => void;
    hasOrganisation: boolean;
}

// ─── Helpers (mirrored from HomeScreen) ──────────────────────────────────────

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
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

const PALETTE = ["#8b5cf6", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#f2a72f", "#06b6d4"];

function templateColor(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return PALETTE[Math.abs(h) % PALETTE.length];
}

function getInitials(name: string | null | undefined): string {
    if (!name) return "?";
    return name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
    draft:      { label: "Draft",       bg: "#ffff5b25", text: "#ffff5b" },
    completed:       { label: "completed",        bg: "#44ff0025", text: "#44ff00" },
    inprogress: { label: "In Progress", bg: "#44d2f925", text: "#44d2f9" },
};

type FilterTab = "All" | "In Progress" | "Draft" | "completed";
const FILTERS: FilterTab[] = ["All", "In Progress", "Draft", "completed"];

const FILTER_TO_STATUS: Record<FilterTab, string | null> = {
    "All":         null,
    "In Progress": "inprogress",
    "Draft":       "draft",
    "completed":        "completed",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportListScreen({ onNavigate, onOpenSidebar,hasOrganisation }: Props) {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
    const [comparing, setComparing] = useState<string[]>([]);

    const { user } = useAuth();
    const initials = getInitials(user?.displayName ?? user?.email);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        listReportsByUser(user.uid)
            .then((all) => {
                all.sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
                setReports(all);
            })
            .catch((e) => console.warn("Failed to load reports", e))
            .finally(() => setLoading(false));
    }, [user?.uid]);

    const filtered = reports.filter((r) => {
        const statusFilter = FILTER_TO_STATUS[activeFilter];
        const matchFilter = statusFilter === null || r.status === statusFilter;
        const q = search.toLowerCase();
        const matchSearch =
            r.title.toLowerCase().includes(q) ||
            r.templateName.toLowerCase().includes(q);
        return matchFilter && matchSearch;
    });

    const toggleCompare = (id: string) => {
        setComparing((prev) =>
            prev.includes(id)
                ? prev.filter((x) => x !== id)
                : prev.length < 2
                  ? [...prev, id]
                  : prev,
        );
    };

    const handleCompare = () => {
        const a = reports.find((r) => r.id === comparing[0]);
        const b = reports.find((r) => r.id === comparing[1]);
        if (!a || !b) return;
        store.setComparisonReports([a, b]);
        onNavigate("reportComparison");
    };

    return (
        <View className="flex-1 bg-background">
            <AppHeader onOpenSidebar={onOpenSidebar} onNavigate={onNavigate} profileInitials={initials} active="reports" />

            <View className="px-5 pt-5 pb-4">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-white text-2xl font-bold">Reports</Text>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => onNavigate("reportSetup")}
                        className="bg-primary rounded-2xl px-4 py-2"
                    >
                        <Text className="text-white font-bold text-sm">+ New</Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View className="flex-row items-center bg-slate-900 rounded-2xl px-4 h-11 gap-2">
                    <Ionicons name="search-outline" size={16} color="#71717a" />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search reports…"
                        placeholderTextColor="#52525b"
                        className="flex-1 text-white text-sm"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch("")}>
                            <Ionicons name="close-circle" size={16} color="#52525b" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filter Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12, alignItems: "center" }}
            >
                {FILTERS.map((f) => (
                    <TouchableOpacity
                        key={f}
                        activeOpacity={0.7}
                        onPress={() => setActiveFilter(f)}
                        className={`py-1.5 rounded-xl items-center ${activeFilter === f ? "bg-primary" : "bg-slate-900"}`}
                        style={{ minWidth: 82 }}
                    >
                        <Text className={`text-sm font-medium ${activeFilter === f ? "text-white" : "text-zinc-400"}`}>
                            {f}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Compare mode banner */}
            {comparing.length > 0 && (
                <View className="mx-5 mb-3 bg-slate-800 rounded-2xl px-4 py-3 flex-row items-center justify-between">
                    <Text className="text-white text-sm font-semibold">
                        {comparing.length === 1 ? "1 selected — pick one more" : "2 selected"}
                    </Text>
                    <TouchableOpacity onPress={() => setComparing([])}>
                        <Text className="text-primary text-sm font-semibold">Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Report List */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
            >
                {loading ? (
                    <View className="items-center mt-16">
                        <ActivityIndicator color="#f2a72f" />
                    </View>
                ) : filtered.length === 0 ? (
                    <View className="items-center mt-16 gap-3">
                        <Ionicons name="document-text-outline" size={48} color="#3f3f46" />
                        <Text className="text-zinc-500 text-sm">
                            {reports.length === 0 ? "No reports yet" : "No reports match your search"}
                        </Text>
                        {reports.length === 0 && (
                            <TouchableOpacity onPress={() => onNavigate("reportSetup")} className="mt-1">
                                <Text className="text-primary text-sm font-semibold">Create your first report</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View className="gap-3">
                        {filtered.map((report) => {
                            const color = templateColor(report.templateName);
                            const cfg = STATUS_CFG[report.status] ?? STATUS_CFG.draft;
                            const isSelected = comparing.includes(report.id);

                            return (
                                <TouchableOpacity
                                    key={report.id}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        if (comparing.length > 0) {
                                            toggleCompare(report.id);
                                        } else {
                                            store.setSelectedReport(report);
                                            onNavigate("reportDetail");
                                        }
                                    }}
                                    onLongPress={() => toggleCompare(report.id)}
                                    className={`flex-row items-center bg-slate-900 rounded-2xl overflow-hidden ${isSelected ? "border border-primary" : ""}`}
                                >
                                    {/* Left color strip */}
                                    <View style={{ width: 4, alignSelf: "stretch", backgroundColor: color }} />

                                    {/* Icon */}
                                    <View
                                        className="w-10 h-10 rounded-xl m-3 items-center justify-center"
                                        style={{ backgroundColor: color + "33" }}
                                    >
                                        <Ionicons name="document-text" size={18} color={color} />
                                    </View>

                                    {/* Text */}
                                    <View className="flex-1 py-3 pr-2">
                                        <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                                            {report.title}
                                        </Text>
                                        <Text className="text-zinc-500 text-xs mt-0.5">
                                            {report.templateName} · {timeAgo(report.updatedAt)}
                                        </Text>
                                    </View>

                                    {/* Score */}
                                    {report.score !== null && (
                                        <Text className="text-zinc-400 text-xs mr-2">{report.score}%</Text>
                                    )}

                                    {/* Status Badge */}
                                    <View
                                        className="mx-3 px-2.5 py-1 rounded-full"
                                        style={{ backgroundColor: cfg.bg }}
                                    >
                                        <Text className="text-xs font-semibold" style={{ color: cfg.text }}>
                                            {cfg.label}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {!loading && comparing.length === 0 && filtered.length > 1 && (
                    <Text className="text-zinc-600 text-xs text-center mt-4">
                        Long-press a report to select for comparison
                    </Text>
                )}
            </ScrollView>

            {comparing.length === 2 && (
                <View className="px-5 pb-3 bg-background">
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleCompare}
                        className="bg-primary rounded-2xl py-3.5 flex-row items-center justify-center gap-2"
                    >
                        <Ionicons name="git-compare-outline" size={18} color="#fff" />
                        <Text className="text-white font-bold text-sm">Compare 2 Reports</Text>
                    </TouchableOpacity>
                </View>
            )}

            <BottomNavBar active="reports" onNavigate={onNavigate} hasOrganisation={hasOrganisation} />
        </View>
    );
}
