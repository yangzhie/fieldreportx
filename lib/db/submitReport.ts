import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { Platform } from "react-native";

import { auth, db } from "@/lib/firebase";
import { computeReportChecksum, fnv1a32 } from "@/lib/checksum";
import { store } from "@/lib/store";
import { SYSTEM_TEMPLATES } from "@/lib/templates/systemTemplates";
import { ReportPhoto, ReportSection, RouteData } from "@/lib/types";
import { uploadFile } from "./storage";

function randomId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Recursively removes undefined values from any object/array before a
 * Firestore write. Firestore rejects undefined; null is fine.
 * Passes Timestamp, FieldValue, and other non-plain-object instances through
 * unchanged so SDK sentinels (serverTimestamp, etc.) survive the walk.
 */
function deepClean(value: unknown): unknown {
    if (value === undefined) return null;
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(deepClean);
    // Preserve Firestore special objects (Timestamp, FieldValue, GeoPoint …)
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = deepClean(v);
    }
    return out;
}

function fmtDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Submits the current in-progress report to Firestore.
 *
 * - Uploads all photo / joint_angle images to Firebase Storage in parallel.
 * - Replaces localUri references with Storage download URLs in field values.
 * - Extracts route data, GPS origin, and signature from field values.
 * - Writes a single Firestore document and returns the new report ID.
 */
export async function submitReport(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    const template =
        store.selectedUserTemplate ??
        SYSTEM_TEMPLATES.find((t) => t.id === store.selectedTemplateId) ??
        null;
    if (!template) throw new Error("No template selected");

    const templateVersion: number = (template as any).version ?? 1;

    const setup = store.reportSetup;
    if (!setup) throw new Error("No report setup found");

    // Reserve a Firestore doc ID before uploading so paths are stable
    const reportRef = doc(collection(db, "reports"));
    const reportId = reportRef.id;

    const allPhotos: ReportPhoto[] = [];
    let routeData: RouteData | null = null;
    let signatureValue: string | null = null;
    let gps: { lat: number; lng: number } | null = null;

    // Process all sections in parallel
    const sections: ReportSection[] = await Promise.all(
        template.sections.map(async (sec): Promise<ReportSection> => {
            const rawValues = store.getFieldValues(sec.id);
            const status = store.getSectionStatus(sec.id);
            const finalValues: Record<string, string | boolean | number> = {};
            const photoIds: string[] = [];

            for (const field of sec.fields) {
                const raw = rawValues[field.id];
                if (raw === undefined || raw === null || raw === "" || raw === false) continue;

                if (field.type === "photo") {
                    let parsed: any[];
                    try {
                        const p = JSON.parse(String(raw));
                        parsed = Array.isArray(p) ? p : [p];
                    } catch { continue; }

                    const uploaded = await Promise.all(
                        parsed.map(async (p: any) => {
                            const photoId = randomId();
                            const localUri: string = p.uri ?? p.localUri ?? "";
                            let url: string = localUri;
                            try {
                                url = await uploadFile(
                                    localUri,
                                    `reports/${reportId}/photos/${photoId}`,
                                );
                            } catch (e) {
                                console.warn("Photo upload failed, keeping localUri", e);
                            }
                            const rp: ReportPhoto = {
                                id: photoId,
                                url,
                                localUri,
                                sectionId: sec.id,
                                gps: p.gps ?? null,
                                annotations: p.annotations ?? [],
                                capturedAt: Timestamp.fromMillis(p.capturedAt ?? Date.now()),
                            };
                            allPhotos.push(rp);
                            photoIds.push(photoId);
                            return { ...p, url, localUri, id: photoId };
                        }),
                    );

                    finalValues[field.id] = JSON.stringify(
                        uploaded.length === 1 ? uploaded[0] : uploaded,
                    );
                } else if (field.type === "joint_angle") {
                    try {
                        const d = JSON.parse(String(raw));
                        if (d.imageUri) {
                            const photoId = randomId();
                            let url: string = d.imageUri;
                            try {
                                url = await uploadFile(
                                    d.imageUri,
                                    `reports/${reportId}/joint_angles/${photoId}`,
                                );
                            } catch (e) {
                                console.warn("Joint angle image upload failed", e);
                            }
                            const rp: ReportPhoto = {
                                id: photoId,
                                url,
                                localUri: d.imageUri,
                                sectionId: sec.id,
                                gps: null,
                                annotations: [],
                                capturedAt: Timestamp.fromMillis(Date.now()),
                            };
                            allPhotos.push(rp);
                            photoIds.push(photoId);
                            finalValues[field.id] = JSON.stringify({ ...d, imageUri: url });
                        } else {
                            finalValues[field.id] = raw;
                        }
                    } catch {
                        finalValues[field.id] = raw;
                    }
                } else if (field.type === "route") {
                    try {
                        const d = JSON.parse(String(raw));
                        const durSec = Math.floor((d.endTime - d.startTime) / 1000);
                        routeData = {
                            distanceKm: d.distanceKm,
                            duration: fmtDuration(durSec),
                            waypoints: (d.waypoints ?? []).map((w: any) => ({
                                lat: w.lat,
                                lng: w.lng,
                            })),
                            markers: d.stops?.length ?? 0,
                        };
                        if (!gps && d.waypoints?.length > 0) {
                            gps = { lat: d.waypoints[0].lat, lng: d.waypoints[0].lng };
                        }
                    } catch { /* leave routeData null */ }
                    finalValues[field.id] = raw;
                } else if (field.type === "signature") {
                    if (!signatureValue) signatureValue = String(raw);
                    finalValues[field.id] = raw;
                } else {
                    finalValues[field.id] = raw;
                }
            }

            return {
                id: sec.id,
                name: sec.name,
                status,
                fieldValues: finalValues,
                notes: "",
                photoIds,
                score: null,
            };
        }),
    );

    const completedCount = sections.filter(
        (s) => s.status === "completed" || s.status === "partial",
    ).length;
    const score = sections.length > 0
        ? Math.round((completedCount / sections.length) * 100)
        : 0;

    const deviceHash = fnv1a32(user.uid + Platform.OS);

    const checksum = computeReportChecksum({
        title: setup.title || "Untitled Report",
        templateId: template.id,
        templateVersion,
        inspectorId: user.uid,
        sections,
        score,
    });

    await setDoc(reportRef, deepClean({
        id: reportId,
        title: setup.title || "Untitled Report",
        templateId: template.id,
        templateName: template.name,
        templateVersion,
        organisationId: null,
        inspectorId: user.uid,
        inspectorName: setup.inspectorName || user.displayName || user.email || "Unknown",
        status: "completed",
        score,
        gps,
        routeData,
        signatureUrl: signatureValue,
        checksum,
        deviceHash,
        sections,
        photos: allPhotos,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }) as any);

    return reportId;
}
