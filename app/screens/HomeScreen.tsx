import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import AppHeader from "@/components/Header";
import BottomNavBar, { AppScreen } from "@/components/BottomNavBar";

import { listReportsByUser } from "@/lib/db/reports";

import { auth } from "@/lib/firebase";
import { store } from "@/lib/store";
import { Report } from "@/lib/types";

interface Props {
    onNavigate: (screen: AppScreen) => void;
    onOpenSidebar: () => void;
    hasOrganisation?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMs(ts: any): number {
    if (!ts) return 0;

    if (typeof ts === "number") return ts;

    if (typeof ts.toMillis === "function") {
        return ts.toMillis();
    }

    if (ts.seconds !== undefined) {
        return ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6;
    }

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

const PALETTE = [
    "#8b5cf6",
    "#22c55e",
    "#f59e0b",
    "#3b82f6",
    "#ef4444",
    "#f2a72f",
    "#06b6d4",
];

function templateColor(name: string): string {
    let h = 0;

    for (const c of name) {
        h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    }

    return PALETTE[Math.abs(h) % PALETTE.length];
}

const STATUS_CFG: Record<
    string,
    { label: string; bg: string; text: string }
> = {
    draft: {
        label: "Draft",
        bg: "#ffff5b25",
        text: "#ffff5b",
    },

    completed: {
        label: "completed",
        bg: "#44ff0025",
        text: "#44ff00",
    },

    inprogress: {
        label: "In Progress",
        bg: "#44d2f925",
        text: "#44d2f9",
    },
};

function getInitials(name: string | null | undefined): string {
    if (!name) return "?";

    return name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen({
    onNavigate,
    onOpenSidebar,
    hasOrganisation = false,
}: Props) {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    const user = auth.currentUser;

    const firstName =
        user?.displayName?.split(" ")[0] ??
        user?.email?.split("@")[0] ??
        "there";

    const initials = getInitials(
        user?.displayName ?? user?.email
    );

    // ─── Reports ──────────────────────────────────────────────────────────────

    const fetchReports = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            const all = await listReportsByUser(user.uid);

            // Sort most recent first
            all.sort(
                (a, b) => toMs(b.updatedAt) - toMs(a.updatedAt)
            );

            setReports(all);
        } catch (e) {
            console.warn("Failed to load reports", e);
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // ─── Stats ────────────────────────────────────────────────────────────────

    const now = new Date();

    const thisMonthMs = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    ).getTime();

    const reportsThisMonth = reports.filter(
        (r) => toMs(r.createdAt) >= thisMonthMs
    ).length;

    const inProgressCount = reports.filter(
        (r) => r.status === "inprogress"
    ).length;

    const recent = reports.slice(0, 5);

    return (
        <View className="flex-1 bg-background">
            <AppHeader
                onOpenSidebar={onOpenSidebar}
                onNavigate={onNavigate}
                profileInitials={initials}
                active="home"
            />

            {/* Greeting */}
            <View className="flex-row items-center px-5 pt-5 pb-5">
                <View>
                    <Text className="text-white text-2xl font-bold">
                        Hello, {firstName}
                    </Text>

                    <Text className="text-zinc-400 text-sm mt-0.5">
                        {inProgressCount > 0
                            ? `${inProgressCount} report${
                                  inProgressCount !== 1 ? "s" : ""
                              } in progress`
                            : "No reports in progress"}
                    </Text>
                </View>
            </View>

            {/* Stats */}
            <View className="flex-row mx-5 gap-3 mb-4">
                <View className="flex-1 bg-slate-900 rounded-2xl p-4">
                    <Text className="text-white text-2xl font-bold">
                        {loading ? "—" : reportsThisMonth}
                    </Text>

                    <Text className="text-zinc-500 text-xs mt-0.5">
                        Reports this month
                    </Text>
                </View>

                <View className="flex-1 bg-slate-900 rounded-2xl p-4">
                    <Text className="text-white text-2xl font-bold">
                        {loading ? "—" : inProgressCount}
                    </Text>

                    <Text className="text-zinc-500 text-xs mt-0.5">
                        In progress
                    </Text>
                </View>
            </View>

            {/* CTA */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onNavigate("reportSetup")}
                className="bg-primary mx-5 rounded-2xl py-4 items-center mb-6"
            >
                <Text className="text-white font-bold text-base">
                    + New report
                </Text>
            </TouchableOpacity>

            {/* Label */}
            <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mx-5 mb-3">
                Recent Reports
            </Text>

            {/* Reports */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: 100,
                }}
            >
                {loading ? (
                    <View className="items-center py-10">
                        <ActivityIndicator color="#f2a72f" />
                    </View>
                ) : recent.length === 0 ? (
                    <View className="items-center py-10 gap-2">
                        <Ionicons
                            name="document-text-outline"
                            size={36}
                            color="#3f3f46"
                        />

                        <Text className="text-zinc-500 text-sm">
                            No reports yet
                        </Text>

                        <TouchableOpacity
                            onPress={() =>
                                onNavigate("reportSetup")
                            }
                            className="mt-1"
                        >
                            <Text className="text-primary text-sm font-semibold">
                                Create your first report
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View className="gap-3">
                        {recent.map((report) => {
                            const color = templateColor(
                                report.templateName
                            );

                            const cfg =
                                STATUS_CFG[report.status] ??
                                STATUS_CFG.draft;

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
                                    {/* Left Color Strip */}
                                    <View
                                        style={{
                                            width: 4,
                                            alignSelf: "stretch",
                                            backgroundColor: color,
                                        }}
                                    />

                                    {/* Icon */}
                                    <View
                                        className="w-10 h-10 rounded-xl m-3 items-center justify-center"
                                        style={{
                                            backgroundColor:
                                                color + "33",
                                        }}
                                    >
                                        <Ionicons
                                            name="document-text"
                                            size={18}
                                            color={color}
                                        />
                                    </View>

                                    {/* Text */}
                                    <View className="flex-1 py-3 pr-2">
                                        <Text
                                            className="text-white font-semibold text-sm"
                                            numberOfLines={1}
                                        >
                                            {report.title}
                                        </Text>

                                        <Text className="text-zinc-500 text-xs mt-0.5">
                                            {report.templateName} ·{" "}
                                            {timeAgo(
                                                report.updatedAt
                                            )}
                                        </Text>
                                    </View>

                                    {/* Status */}
                                    <View
                                        className="mx-3 px-2.5 py-1 rounded-full"
                                        style={{
                                            backgroundColor: cfg.bg,
                                        }}
                                    >
                                        <Text
                                            className="text-xs font-semibold"
                                            style={{
                                                color: cfg.text,
                                            }}
                                        >
                                            {cfg.label}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Bottom Nav */}
            <BottomNavBar
                active="home"
                onNavigate={onNavigate}
                hasOrganisation={hasOrganisation}
            />
        </View>
    );
}