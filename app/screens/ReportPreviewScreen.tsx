import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { doc, updateDoc } from "firebase/firestore";

import { AppScreen } from "@/components/BottomNavBar";
import SignaturePad from "@/components/SignaturePad";
import { db } from "@/lib/firebase";
import { submitReport } from "@/lib/db/submitReport";
import { store } from "@/lib/store";
import { SYSTEM_TEMPLATES } from "@/lib/templates/systemTemplates";
import { FieldType, SectionStatus } from "@/lib/types";

interface Props {
    onNavigate: (screen: AppScreen) => void;
    hasOrganisation?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatFieldValue(type: FieldType, value: string | boolean | number | undefined): string | null {
    if (value === undefined || value === null || value === "" || value === false) return null;
    switch (type) {
        case "text":
        case "select":
            return String(value).trim() || null;
        case "number":
            return String(value);
        case "checkbox":
            return value ? "Yes" : null;
        case "signature":
            return value ? "Signed" : null;
        case "timer": {
            const sec = Number(value);
            return sec > 0 ? fmtDuration(sec) : null;
        }
        case "route": {
            try {
                const d = JSON.parse(String(value));
                const dur = Math.floor((d.endTime - d.startTime) / 1000);
                return `${d.distanceKm} km · ${fmtDuration(dur)} · avg ${d.avgSpeedKmh} km/h${(d.stops?.length ?? 0) > 0 ? ` · ${d.stops.length} stops` : ""}`;
            } catch { return "Route recorded"; }
        }
        case "accelerometer": {
            try {
                const d = JSON.parse(String(value));
                return `${d.category} · RMS ${d.rms} g · Peak ${d.peak} g`;
            } catch { return "Sensor data recorded"; }
        }
        case "stopwatch": {
            try {
                const d = JSON.parse(String(value));
                const trials: number[] = d.trials ?? [];
                return `${trials.length} trial${trials.length !== 1 ? "s" : ""} · avg ${d.avg} ms${trials.map((t: number, i: number) => ` · T${i + 1}: ${t} ms`).join("")}`;
            } catch { return "Timing recorded"; }
        }
        case "joint_angle": {
            try {
                const d = JSON.parse(String(value));
                return `${d.joint} — ${d.angle}° (${Math.round(d.confidence * 100)}% confidence)`;
            } catch { return "Angle captured"; }
        }
        case "photo":
            return null; // handled separately as thumbnails
        default:
            return String(value) || null;
    }
}

/** Returns an array of local URIs from a photo field value (single obj or array). */
function extractPhotoUris(value: string | boolean | number | undefined): string[] {
    if (!value || typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.map((p: any) => p.localUri ?? p.url).filter(Boolean);
        }
        const uri = parsed.localUri ?? parsed.url;
        return uri ? [uri] : [];
    } catch {
        return [];
    }
}

function statusConfig(status: SectionStatus) {
    switch (status) {
        case "completed":  return { icon: "checkmark"           as const, color: "#22c55e", bg: "#22c55e20", label: "Completed"   };
        case "partial":    return { icon: "remove"              as const, color: "#eab308", bg: "#eab30820", label: "Partial"      };
        case "inprogress": return { icon: "ellipsis-horizontal" as const, color: "#f2a72f", bg: "#f2a72f20", label: "In Progress"  };
        case "skipped":    return { icon: "remove"              as const, color: "#52525b", bg: "#3f3f4640", label: "Skipped"      };
        default:           return { icon: "remove"              as const, color: "#52525b", bg: "#3f3f4640", label: "Not Started"  };
    }
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ReportPreviewScreen({ onNavigate }: Props) {
    const [expanded, setExpanded] = useState<number | null>(null);
    const [sigVisible, setSigVisible] = useState(false);
    const [renderTick, setRenderTick] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [showOrgShareModal, setShowOrgShareModal] = useState(false);
    const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);

    const setup = store.reportSetup;
    const template = store.selectedUserTemplate
        ?? SYSTEM_TEMPLATES.find((t) => t.id === store.selectedTemplateId)
        ?? null;

    const sections = template?.sections ?? [];

    // Derived stats (re-runs when renderTick changes after signature save)
    const { completedCount, filledFields, photoCount, hasSignature, hasRoute } = useMemo(() => {
        let completedCount = 0;
        let filledFields = 0;
        let photoCount = 0;
        let hasSignature = false;
        let hasRoute = false;

        for (const sec of sections) {
            const status = store.getSectionStatus(sec.id);
            if (status === "completed" || status === "partial") completedCount++;
            const vals = store.getFieldValues(sec.id);
            for (const field of sec.fields) {
                const v = vals[field.id];
                if (v === undefined || v === null || v === "" || v === false) continue;
                filledFields++;
                if (field.type === "photo") photoCount += Math.max(1, extractPhotoUris(v).length);
                if (field.type === "signature" && v) hasSignature = true;
                if (field.type === "route" && v) hasRoute = true;
            }
        }
        return { completedCount, filledFields, photoCount, hasSignature, hasRoute };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sections, renderTick]);

    const score = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;
    const scoreColor = score >= 80 ? "#22c55e" : score >= 50 ? "#f2a72f" : "#ef4444";

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const reportId = await submitReport();
            if (store.orgReportMode && store.currentOrgId) {
                // Created from Shared tab — auto-share, no prompt
                await updateDoc(doc(db, "reports", reportId), { organisationId: store.currentOrgId });
                store.clearReport();
                onNavigate("sharedReports");
            } else if (store.currentOrgId) {
                setSubmittedReportId(reportId);
                setShowOrgShareModal(true);
            } else {
                store.clearReport();
                onNavigate("reports");
            }
        } catch (e: any) {
            Alert.alert("Submit failed", e?.message ?? "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleShareWithOrg = async () => {
        if (submittedReportId && store.currentOrgId) {
            try {
                await updateDoc(doc(db, "reports", submittedReportId), {
                    organisationId: store.currentOrgId,
                });
            } catch (e) {
                console.warn("Failed to share report with org", e);
            }
        }
        setShowOrgShareModal(false);
        store.clearReport();
        onNavigate("reports");
    };

    const handleSkipOrgShare = () => {
        setShowOrgShareModal(false);
        store.clearReport();
        onNavigate("reports");
    };

    const handleSignaturecompleted = (paths: string) => {
        // Write signature to the first signature-type field found in the template
        for (const sec of sections) {
            const sigField = sec.fields.find((f) => f.type === "signature");
            if (sigField) {
                const existing = store.getFieldValues(sec.id);
                const updated = { ...existing, [sigField.id]: paths };
                store.setFieldValues(sec.id, updated);
                // Recompute status: completed if all required fields are filled
                const allRequired = sec.fields
                    .filter((f) => f.required)
                    .every((f) => {
                        const v = updated[f.id];
                        return v !== undefined && v !== null && v !== "" && v !== false;
                    });
                const anyFilled = sec.fields.some((f) => {
                    const v = updated[f.id];
                    return v !== undefined && v !== null && v !== "" && v !== false;
                });
                store.setSectionStatus(
                    sec.id,
                    allRequired ? "completed" : anyFilled ? "partial" : "notstarted",
                );
                break;
            }
        }
        setSigVisible(false);
        setRenderTick((n) => n + 1);
    };

    if (!template || !setup) {
        return (
            <View className="flex-1 bg-background items-center justify-center gap-3">
                <Ionicons name="document-outline" size={40} color="#3f3f46" />
                <Text className="text-zinc-500 text-sm">No report in progress</Text>
                <TouchableOpacity onPress={() => onNavigate("home")} className="mt-2">
                    <Text className="text-primary text-sm font-semibold">Go Home</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            {/* Org share modal */}
            <Modal visible={showOrgShareModal} transparent animationType="fade">
                <View className="flex-1 bg-black/70 justify-center px-6">
                    <View className="bg-slate-900 rounded-2xl p-5">
                        <View className="w-12 h-12 rounded-2xl bg-primary/20 items-center justify-center mb-4">
                            <Ionicons name="business-outline" size={24} color="#f2a72f" />
                        </View>
                        <Text className="text-white font-bold text-base mb-1">Share with Organisation?</Text>
                        <Text className="text-zinc-400 text-sm mb-5">
                            Your report has been saved. Would you like to share it with your organisation so other members can view it?
                        </Text>
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={handleSkipOrgShare}
                                className="flex-1 py-3 rounded-xl bg-slate-800 items-center"
                            >
                                <Text className="text-zinc-400 font-semibold">Keep Private</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleShareWithOrg}
                                className="flex-1 py-3 rounded-xl bg-primary items-center"
                            >
                                <Text className="text-white font-semibold">Share</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Signature modal */}
            <Modal visible={sigVisible} animationType="slide" onRequestClose={() => setSigVisible(false)}>
                <SignaturePad
                    oncompleted={handleSignaturecompleted}
                    onCancel={() => setSigVisible(false)}
                />
            </Modal>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-16 pb-4">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => onNavigate("reportEditor")}
                        className="w-9 h-9 items-center justify-center rounded-full bg-slate-800"
                    >
                        <Ionicons name="arrow-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <Text className="text-white text-lg font-bold">Preview</Text>
                </View>
                <TouchableOpacity
                    activeOpacity={0.7}
                    className="flex-row items-center gap-1.5 bg-slate-800 rounded-2xl px-3 py-2"
                >
                    <Ionicons name="share-outline" size={16} color="#f2a72f" />
                    <Text className="text-primary text-sm font-semibold">Export</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

                {/* ── Meta card ─────────────────────────────────────────────── */}
                <View className="mx-5 bg-slate-900 rounded-2xl p-4 gap-3">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                            <Text className="text-white text-base font-bold" numberOfLines={2}>
                                {setup.title || "Untitled Report"}
                            </Text>
                            <Text className="text-zinc-500 text-xs mt-0.5">
                                {template.name}{setup.date ? ` · ${setup.date}` : ""}
                            </Text>
                        </View>
                        {/* Score ring */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => onNavigate("score")}
                            style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: scoreColor, alignItems: "center", justifyContent: "center" }}
                        >
                            <Text style={{ color: scoreColor, fontSize: 16, fontWeight: "800", lineHeight: 18 }}>
                                {score}
                            </Text>
                            <Text style={{ color: scoreColor, fontSize: 8, fontWeight: "600" }}>/ 100</Text>
                        </TouchableOpacity>
                    </View>

                    {[
                        setup.inspectorName ? { label: "Inspector",   value: setup.inspectorName } : null,
                        setup.description   ? { label: "Description", value: setup.description   } : null,
                        setup.gpsEnabled    ? { label: "GPS",         value: "Enabled"           } : null,
                    ].filter(Boolean).map((row) => (
                        <View key={row!.label} className="flex-row items-start justify-between border-t border-zinc-800 pt-2 gap-4">
                            <Text className="text-zinc-500 text-xs shrink-0">{row!.label}</Text>
                            <Text className="text-white text-xs font-medium text-right flex-1" numberOfLines={2}>{row!.value}</Text>
                        </View>
                    ))}
                </View>

                {/* ── Stats row ─────────────────────────────────────────────── */}
                <View className="flex-row mx-5 mt-3 gap-2">
                    {[
                        { value: `${completedCount}/${sections.length}`, label: "Sections"  },
                        { value: String(filledFields),                   label: "Fields"    },
                        { value: String(photoCount),                     label: "Photos"    },
                    ].map((s) => (
                        <View key={s.label} className="flex-1 bg-slate-900 rounded-2xl py-3 items-center">
                            <Text className="text-white text-xl font-bold">{s.value}</Text>
                            <Text className="text-zinc-500 text-xs mt-0.5">{s.label}</Text>
                        </View>
                    ))}
                </View>

                {/* ── Section list ──────────────────────────────────────────── */}
                <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mx-5 mt-4 mb-2">
                    Sections
                </Text>

                <View className="mx-5 gap-2">
                    {sections.map((sec, i) => {
                        const status = store.getSectionStatus(sec.id);
                        const values = store.getFieldValues(sec.id);
                        const cfg = statusConfig(status);
                        const isExpanded = expanded === i;
                        const isInactive = status === "skipped" || status === "notstarted";

                        const textFields = sec.fields.filter((f) =>
                            f.type !== "photo" && formatFieldValue(f.type as FieldType, values[f.id]) !== null,
                        );
                        const photoFields = sec.fields.filter((f) => f.type === "photo");
                        const allPhotoUris = photoFields.flatMap((f) => extractPhotoUris(values[f.id]));
                        const sectionPhotoCount = Math.max(allPhotoUris.length, photoFields.filter(f => values[f.id]).length);

                        return (
                            <TouchableOpacity
                                key={sec.id}
                                activeOpacity={0.7}
                                onPress={() => setExpanded(isExpanded ? null : i)}
                                className="bg-slate-900 rounded-2xl px-4 pt-3.5 pb-3.5"
                            >
                                {/* Row header */}
                                <View className="flex-row items-center">
                                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: cfg.bg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                        <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-sm font-semibold ${isInactive ? "text-zinc-500" : "text-white"}`}>
                                            {sec.name}
                                        </Text>
                                        {!isInactive && (
                                            <Text className="text-zinc-500 text-xs mt-0.5">
                                                {textFields.length} field{textFields.length !== 1 ? "s" : ""}
                                                {sectionPhotoCount > 0 ? ` · ${sectionPhotoCount} photo${sectionPhotoCount !== 1 ? "s" : ""}` : ""}
                                                {" · "}<Text style={{ color: cfg.color }}>{cfg.label}</Text>
                                            </Text>
                                        )}
                                    </View>
                                    <Ionicons
                                        name={isExpanded ? "chevron-up" : "chevron-down"}
                                        size={16}
                                        color="#52525b"
                                    />
                                </View>

                                {/* Expanded content */}
                                {isExpanded && !isInactive && (
                                    <View className="mt-3 pt-3 border-t border-zinc-800 gap-2">
                                        {textFields.map((f) => {
                                            const display = formatFieldValue(f.type as FieldType, values[f.id]);
                                            if (!display) return null;
                                            return (
                                                <View key={f.id} className="flex-row gap-3 items-start">
                                                    <Text className="text-zinc-500 text-xs w-28 shrink-0 pt-0.5" numberOfLines={2}>
                                                        {f.label}
                                                    </Text>
                                                    <Text className="text-zinc-200 text-xs flex-1 leading-relaxed">
                                                        {display}
                                                    </Text>
                                                </View>
                                            );
                                        })}

                                        {allPhotoUris.length > 0 && (
                                            <View className="flex-row flex-wrap gap-2 mt-1">
                                                {allPhotoUris.map((uri, pi) => (
                                                    <Image
                                                        key={pi}
                                                        source={{ uri }}
                                                        style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#1e293b" }}
                                                        resizeMode="cover"
                                                    />
                                                ))}
                                            </View>
                                        )}

                                        {textFields.length === 0 && allPhotoUris.length === 0 && (
                                            <Text className="text-zinc-600 text-xs italic">No field data recorded</Text>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── Route card (if a route was recorded) ─────────────────── */}
                {hasRoute && (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => onNavigate("mapsRoutes")}
                        className="mx-5 mt-3 bg-slate-900 rounded-2xl p-4 flex-row items-center gap-3"
                    >
                        <View className="w-12 h-12 rounded-xl bg-primary/20 items-center justify-center">
                            <Ionicons name="map" size={22} color="#f2a72f" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-semibold text-sm">Route recorded</Text>
                            <Text className="text-zinc-500 text-xs mt-0.5">Tap to view full map</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#52525b" />
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* ── Bottom actions ─────────────────────────────────────────────── */}
            <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-zinc-800 px-5 pb-10 pt-3 gap-2">
                {!hasSignature && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setSigVisible(true)}
                        className="border border-primary rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
                    >
                        <Ionicons name="create-outline" size={16} color="#f2a72f" />
                        <Text className="text-primary font-semibold text-sm">Add Signature</Text>
                    </TouchableOpacity>
                )}
                {hasSignature && (
                    <View className="flex-row items-center justify-center gap-2 py-2">
                        <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                        <Text className="text-green-400 text-sm font-medium">Signed</Text>
                    </View>
                )}
                <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={submitting}
                    onPress={handleSubmit}
                    className="bg-primary rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
                    style={submitting ? { opacity: 0.6 } : undefined}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Ionicons name="document-text-outline" size={16} color="#ffffff" />
                    )}
                    <Text className="text-white font-bold text-sm">
                        {submitting ? "Submitting…" : "Submit Report"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
