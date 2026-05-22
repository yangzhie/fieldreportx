// import { Ionicons } from "@expo/vector-icons";
// import * as FileSystem from "expo-file-system/legacy";
// import * as Print from "expo-print";
// import * as Sharing from "expo-sharing";
// import React, { useEffect, useMemo, useState } from "react";
// import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
// import { Path, Svg } from "react-native-svg";

// import { AppScreen } from "@/components/BottomNavBar";
// import { getTemplate } from "@/lib/db/templates";
// import { store } from "@/lib/store";
// import { SYSTEM_TEMPLATES } from "@/lib/templates/systemTemplates";
// import { FieldType, Report, ReportPhoto, Template } from "@/lib/types";

// interface Props {
//     onNavigate: (screen: AppScreen) => void;
// }

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// function toMs(ts: any): number {
//     if (!ts) return 0;
//     if (typeof ts === "number") return ts;
//     if (typeof ts.toMillis === "function") return ts.toMillis();
//     if (ts.seconds !== undefined) return ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6;
//     return 0;
// }

// function fmtDate(ts: any): string {
//     const ms = toMs(ts);
//     if (!ms) return "";
//     return new Date(ms).toLocaleDateString("en-AU", {
//         day: "numeric", month: "short", year: "numeric",
//     });
// }

// function fmtDuration(sec: number): string {
//     const h = Math.floor(sec / 3600);
//     const m = Math.floor((sec % 3600) / 60);
//     const s = sec % 60;
//     return h > 0
//         ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
//         : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
// }

// /**
//  * Inspects any field value for photo-like structure (has `url` or `localUri`)
//  * without needing the template type. Returns display-ready URIs.
//  */
// function extractFieldPhotoUris(value: string | boolean | number): string[] {
//     if (typeof value !== "string") return [];
//     try {
//         const parsed = JSON.parse(value);
//         const items: any[] = Array.isArray(parsed) ? parsed : [parsed];
//         return items
//             .filter((p) => p && typeof p === "object" && (p.url || p.localUri || p.uri))
//             .map((p) => p.url || p.localUri || p.uri)
//             .filter(Boolean);
//     } catch {
//         return [];
//     }
// }

// function formatFieldValue(type: FieldType, value: string | boolean | number): string | null {
//     if (value === undefined || value === null || value === "" || value === false) return null;
//     switch (type) {
//         case "text":
//         case "select":
//             return String(value).trim() || null;
//         case "number":
//             return String(value);
//         case "checkbox":
//             return "Yes";
//         case "signature":
//             return "Signed";
//         case "timer": {
//             const sec = Number(value);
//             return sec > 0 ? fmtDuration(sec) : null;
//         }
//         case "route": {
//             try {
//                 const d = JSON.parse(String(value));
//                 const dur = Math.floor((d.endTime - d.startTime) / 1000);
//                 return `${d.distanceKm} km · ${fmtDuration(dur)} · avg ${d.avgSpeedKmh} km/h${(d.stops?.length ?? 0) > 0 ? ` · ${d.stops.length} stops` : ""}`;
//             } catch { return "Route recorded"; }
//         }
//         case "accelerometer": {
//             try {
//                 const d = JSON.parse(String(value));
//                 return `${d.category} · RMS ${d.rms} g · Peak ${d.peak} g`;
//             } catch { return "Vibration recorded"; }
//         }
//         case "stopwatch": {
//             try {
//                 const d = JSON.parse(String(value));
//                 const trials: number[] = d.trials ?? [];
//                 return `${trials.length} trial${trials.length !== 1 ? "s" : ""} · avg ${d.avg} ms`;
//             } catch { return "Timing recorded"; }
//         }
//         case "joint_angle": {
//             try {
//                 const d = JSON.parse(String(value));
//                 return `${d.joint} — ${d.angle}° (${Math.round(d.confidence * 100)}% confidence)`;
//             } catch { return "Angle captured"; }
//         }
//         case "photo":
//             return null;
//         default:
//             return String(value) || null;
//     }
// }

// const STATUS_CFG = {
//     draft:      { label: "Draft",       color: "#ffff5b", bg: "#ffff5b20" },
//     completed:       { label: "completed",        color: "#22c55e", bg: "#22c55e20" },
//     inprogress: { label: "In Progress", color: "#44d2f9", bg: "#44d2f920" },
// } as const;

// const SECTION_STATUS_CFG = {
//     completed:  { icon: "checkmark"            as const, color: "#22c55e", bg: "#22c55e20" },
//     partial:    { icon: "remove"               as const, color: "#eab308", bg: "#eab30820" },
//     inprogress: { icon: "ellipsis-horizontal"  as const, color: "#f2a72f", bg: "#f2a72f20" },
//     skipped:    { icon: "remove"               as const, color: "#52525b", bg: "#3f3f4640" },
//     notstarted: { icon: "remove"               as const, color: "#52525b", bg: "#3f3f4640" },
// };

// // ─── Signature renderer ───────────────────────────────────────────────────────

// function sigViewBox(paths: string): string {
//     let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
//     const re = /[ML]([\d.]+),([\d.]+)/g;
//     let m;
//     while ((m = re.exec(paths)) !== null) {
//         const x = parseFloat(m[1]), y = parseFloat(m[2]);
//         if (x < minX) minX = x;
//         if (y < minY) minY = y;
//         if (x > maxX) maxX = x;
//         if (y > maxY) maxY = y;
//     }
//     if (!isFinite(minX)) return "0 0 100 60";
//     const pad = 16;
//     return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
// }

// function SignatureDisplay({ paths }: { paths: string }) {
//     const pathList = paths.split("|").filter(Boolean);
//     if (!pathList.length) return null;
//     const viewBox = sigViewBox(paths);
//     return (
//         <View className="bg-slate-800 rounded-2xl overflow-hidden border border-zinc-700" style={{ height: 120 }}>
//             <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
//                 {pathList.map((d, i) => (
//                     <Path key={i} d={d} stroke="#f2a72f" strokeWidth={2.5} fill="none"
//                         strokeLinecap="round" strokeLinejoin="round" />
//                 ))}
//             </Svg>
//         </View>
//     );
// }

// // ─── PDF export ───────────────────────────────────────────────────────────────

// async function fetchAsDataUri(uri: string): Promise<string | null> {
//     if (!uri) return null;

//     // Local file — read directly without network
//     if (uri.startsWith("file://")) {
//         try {
//             const base64 = await FileSystem.readAsStringAsync(uri, {
//                 encoding: FileSystem.EncodingType.Base64,
//             });
//             return `data:image/jpeg;base64,${base64}`;
//         } catch (e) {
//             console.warn("[PDF] local file read error", uri.slice(0, 60), e);
//             return null;
//         }
//     }

//     // Remote URL — download to temp file then read as base64
//     const cacheDir = FileSystem.cacheDirectory;
//     if (!cacheDir) { console.warn("[PDF] cacheDirectory is null"); return null; }
//     const tmpPath = cacheDir + "pdf_img_" + Math.random().toString(36).slice(2) + ".jpg";
//     try {
//         const result = await FileSystem.downloadAsync(uri, tmpPath);
//         if (result.status !== 200) { console.warn("[PDF] download status", result.status); return null; }
//         const base64 = await FileSystem.readAsStringAsync(tmpPath, {
//             encoding: FileSystem.EncodingType.Base64,
//         });
//         const mime = result.mimeType ?? "image/jpeg";
//         return `data:${mime};base64,${base64}`;
//     } catch (e) {
//         console.warn("[PDF] fetchAsDataUri error", String(e).slice(0, 120));
//         return null;
//     } finally {
//         try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch {}
//     }
// }

// function esc(s: unknown): string {
//     return String(s ?? "")
//         .replace(/&/g, "&amp;")
//         .replace(/</g, "&lt;")
//         .replace(/>/g, "&gt;")
//         .replace(/"/g, "&quot;");
// }

// function buildReportHTML(
//     report: Report,
//     fieldMap: Record<string, { label: string; type: FieldType }>,
//     signaturePaths: string | null,
//     imgMap: Record<string, string> = {},
// ): string {
//     const statusLabels: Record<string, string> = { completed: "completed", draft: "Draft", inprogress: "In Progress" };
//     const statusColors: Record<string, string> = { completed: "#15803d", draft: "#92400e", inprogress: "#1d4ed8" };
//     const statusBgs:   Record<string, string> = { completed: "#dcfce7", draft: "#fef3c7", inprogress: "#dbeafe" };
//     const sectionStatusLabels: Record<string, string> = {
//         completed: "Completed", partial: "Partial", inprogress: "In Progress",
//         skipped: "Skipped", notstarted: "Not started",
//     };
//     const sectionStatusColors: Record<string, string> = {
//         completed: "#15803d", partial: "#854d0e", inprogress: "#92400e",
//         skipped: "#6b7280", notstarted: "#6b7280",
//     };

//     const generatedAt = new Date().toLocaleString("en-AU", {
//         day: "numeric", month: "short", year: "numeric",
//         hour: "2-digit", minute: "2-digit",
//     });

//     const toMs = (ts: any): number => {
//         if (!ts) return 0;
//         if (typeof ts === "number") return ts;
//         if (typeof ts.toMillis === "function") return ts.toMillis();
//         if (ts.seconds !== undefined) return ts.seconds * 1000;
//         return 0;
//     };
//     const createdDate = toMs(report.createdAt)
//         ? new Date(toMs(report.createdAt)).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
//         : "";

//     // Signature inline SVG
//     let sigSvg = "";
//     if (signaturePaths) {
//         const vb = sigViewBox(signaturePaths);
//         const pathEls = signaturePaths.split("|").filter(Boolean)
//             .map((d) => `<path d="${esc(d)}" stroke="#f2a72f" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
//             .join("");
//         sigSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100px;display:block;">${pathEls}</svg>`;
//     }

//     // Sections HTML
//     const sectionsHtml = report.sections.map((sec) => {
//         const scLabel = sectionStatusLabels[sec.status] ?? sec.status;
//         const scColor = sectionStatusColors[sec.status] ?? "#6b7280";

//         const fields = Object.entries(sec.fieldValues)
//             .filter(([fid, val]) => {
//                 const meta = fieldMap[fid];
//                 if (!meta || meta.type === "photo" || meta.type === "signature") return false;
//                 return val !== undefined && val !== null && val !== "" && val !== false;
//             })
//             .map(([fid, val]) => {
//                 const meta = fieldMap[fid] ?? { label: fid, type: "text" as FieldType };
//                 const display = formatFieldValue(meta.type, val);
//                 if (!display) return "";
//                 return `<tr>
//                     <td style="width:140px;padding:6px 8px;color:#6b7280;font-size:12px;vertical-align:top;">${esc(meta.label)}</td>
//                     <td style="padding:6px 8px;color:#111827;font-size:12px;font-weight:500;">${esc(display)}</td>
//                 </tr>`;
//             }).join("");

//         const photoUrisFromFields = Object.values(sec.fieldValues)
//             .flatMap(extractFieldPhotoUris)
//             .filter((u): u is string => typeof u === "string" && u.length > 0);
//         const storedUrisForSec = (report.photos ?? [])
//             .filter((p) => p.sectionId === sec.id)
//             .map((p) => p.url || p.localUri)
//             .filter((u): u is string => typeof u === "string" && u.length > 0);
//         const allUris = [...new Set([...storedUrisForSec, ...photoUrisFromFields])];
//         // Only include images that were successfully pre-fetched as data URIs
//         const resolvedUris = allUris.filter((u) => imgMap[u]);

//         const photosHtml = resolvedUris.length > 0
//             ? `<div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
//                 ${resolvedUris.map((u) => `<img src="${imgMap[u]}" style="width:100%;max-width:100%;height:auto;border-radius:10px;display:block;" />`).join("")}
//                </div>`
//             : "";

//         const bodyHtml = fields || photosHtml
//             ? `<div style="padding:12px 16px;border-top:1px solid #f3f4f6;">
//                 ${fields ? `<table style="width:100%;border-collapse:collapse;">${fields}</table>` : ""}
//                 ${photosHtml}
//                </div>`
//             : "";

//         return `
//         <div style="border:1px solid #e5e7eb;border-radius:12px;margin-bottom:14px;overflow:hidden;">
//             <div style="background:#f9fafb;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
//                 <span style="font-size:13px;font-weight:700;color:#111827;">${esc(sec.name)}</span>
//                 <span style="font-size:11px;font-weight:700;color:${scColor};">${esc(scLabel)}</span>
//             </div>
//             ${bodyHtml}
//         </div>`;
//     }).join("");

//     const routeHtml = report.routeData ? `
//         <h2 style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:24px 0 12px;">Route</h2>
//         <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
//             <table style="width:100%;border-collapse:collapse;">
//                 <tr><td style="padding:5px 8px;color:#6b7280;font-size:12px;width:120px;">Distance</td><td style="padding:5px 8px;font-size:12px;font-weight:600;">${esc(report.routeData.distanceKm)} km</td></tr>
//                 <tr><td style="padding:5px 8px;color:#6b7280;font-size:12px;">Duration</td><td style="padding:5px 8px;font-size:12px;font-weight:600;">${esc(report.routeData.duration)}</td></tr>
//                 <tr><td style="padding:5px 8px;color:#6b7280;font-size:12px;">Waypoints</td><td style="padding:5px 8px;font-size:12px;font-weight:600;">${report.routeData.waypoints.length}</td></tr>
//                 <tr><td style="padding:5px 8px;color:#6b7280;font-size:12px;">Stops</td><td style="padding:5px 8px;font-size:12px;font-weight:600;">${report.routeData.markers}</td></tr>
//             </table>
//         </div>` : "";

//     const sigHtml = sigSvg ? `
//         <h2 style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:24px 0 12px;">Signature</h2>
//         <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#f9fafb;">
//             ${sigSvg}
//         </div>` : "";

//     const completedCount = report.sections.filter(
//         (s) => s.status === "completed" || s.status === "partial",
//     ).length;

//     return `<!DOCTYPE html>
// <html>
// <head>
// <meta charset="utf-8">
// <meta name="viewport" content="width=device-width, initial-scale=1">
// <style>
//   * { margin:0; padding:0; box-sizing:border-box; }
//   body { font-family:-apple-system,Arial,Helvetica,sans-serif; color:#111827; background:#fff; padding:40px 48px; font-size:13px; }
//   @media print { body { padding:20px 28px; } }
// </style>
// </head>
// <body>

// <!-- Header -->
// <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #f2a72f;padding-bottom:18px;margin-bottom:28px;">
//   <div>
//     <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#f2a72f;">Field<span style="color:#111827;">ReportX</span></div>
//     <div style="font-size:11px;color:#9ca3af;margin-top:3px;">Professional Field Inspection Reports</div>
//   </div>
//   <div style="text-align:right;">
//     <div style="font-size:11px;color:#9ca3af;">Generated</div>
//     <div style="font-size:12px;font-weight:600;color:#374151;">${esc(generatedAt)}</div>
//   </div>
// </div>

// <!-- Meta card -->
// <div style="background:#f9fafb;border-radius:14px;padding:20px;margin-bottom:20px;">
//   <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
//     <div style="flex:1;padding-right:16px;">
//       <div style="font-size:20px;font-weight:800;color:#111827;margin-bottom:4px;">${esc(report.title)}</div>
//       <div style="font-size:12px;color:#6b7280;">${esc(report.templateName)}${createdDate ? ` &middot; ${createdDate}` : ""}</div>
//     </div>
//     <div style="text-align:right;">
//       <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${statusBgs[report.status] ?? "#f3f4f6"};color:${statusColors[report.status] ?? "#374151"};">
//         ${esc(statusLabels[report.status] ?? report.status)}
//       </span>
//       ${report.score != null ? `<div style="margin-top:8px;font-size:24px;font-weight:900;color:${report.score >= 80 ? "#15803d" : report.score >= 50 ? "#f59e0b" : "#dc2626"};">${report.score}<span style="font-size:12px;font-weight:500;color:#9ca3af;">/100</span></div>` : ""}
//     </div>
//   </div>
//   <div style="border-top:1px solid #e5e7eb;padding-top:12px;display:flex;gap:24px;flex-wrap:wrap;">
//     <div><span style="color:#6b7280;font-size:11px;">Inspector</span><br><span style="font-weight:600;font-size:12px;">${esc(report.inspectorName)}</span></div>
//     <div><span style="color:#6b7280;font-size:11px;">Sections completed</span><br><span style="font-weight:600;font-size:12px;">${completedCount} / ${report.sections.length}</span></div>
//     <div><span style="color:#6b7280;font-size:11px;">Photos</span><br><span style="font-weight:600;font-size:12px;">${report.photos.length}</span></div>
//     ${report.gps ? `<div><span style="color:#6b7280;font-size:11px;">GPS</span><br><span style="font-weight:600;font-size:12px;">${report.gps.lat.toFixed(5)}, ${report.gps.lng.toFixed(5)}</span></div>` : ""}
//   </div>
// </div>

// <!-- Sections -->
// <h2 style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Sections</h2>
// ${sectionsHtml}

// ${routeHtml}
// ${sigHtml}

// <!-- Footer -->
// <div style="margin-top:40px;border-top:1px solid #e5e7eb;padding-top:14px;display:flex;justify-content:space-between;align-items:center;">
//   <div style="font-size:11px;color:#d1d5db;font-weight:700;">FieldReportX</div>
//   <div style="font-size:10px;color:#9ca3af;">Report ID: ${esc(report.id)}</div>
// </div>

// </body>
// </html>`;
// }

// // ─── Main screen ──────────────────────────────────────────────────────────────

// export default function ReportDetailScreen({ onNavigate }: Props) {
//     const report = store.selectedReport;
//     const [template, setTemplate] = useState<Template | null>(null);
//     const [expanded, setExpanded] = useState<string | null>(null);
//     const [exporting, setExporting] = useState(false);

//     // Resolve the template: system first, then Firestore
//     useEffect(() => {
//         if (!report) return;
//         const sys = SYSTEM_TEMPLATES.find((t) => t.id === report.templateId);
//         if (sys) { setTemplate(sys as unknown as Template); return; }
//         getTemplate(report.templateId).then((t) => { if (t) setTemplate(t); });
//     }, [report?.templateId]);

//     // Build fieldId → {label, type} lookup from the template
//     const fieldMap = useMemo(() => {
//         const map: Record<string, { label: string; type: FieldType }> = {};
//         if (template) {
//             for (const sec of template.sections) {
//                 for (const f of sec.fields) {
//                     map[f.id] = { label: f.label, type: f.type };
//                 }
//             }
//         }
//         return map;
//     }, [template]);

//     // Photos grouped by sectionId (from the uploaded Storage array)
//     const photosBySec = useMemo(() => {
//         const map: Record<string, ReportPhoto[]> = {};
//         for (const p of (report?.photos ?? [])) {
//             (map[p.sectionId] ??= []).push(p);
//         }
//         return map;
//     }, [report]);

//     // Signature is stored directly on the report — no template needed
//     const signaturePaths = report?.signatureUrl ?? null;

//     const handleExport = async () => {
//         if (!report) return;
//         setExporting(true);
//         try {
//             // Collect every photo URI: Firebase Storage (https) AND local (file://)
//             const storedUris = (report.photos ?? [])
//                 .map((p) => p.url || p.localUri)
//                 .filter((u): u is string => typeof u === "string" && u.length > 0);
//             const fieldUris = report.sections.flatMap((sec) =>
//                 Object.values(sec.fieldValues).flatMap(extractFieldPhotoUris)
//             ).filter((u): u is string => typeof u === "string" && u.length > 0);
//             const allUris = [...new Set([...storedUris, ...fieldUris])];

//             const imgEntries = await Promise.all(
//                 allUris.map(async (uri) => [uri, await fetchAsDataUri(uri)] as const)
//             );
//             const imgMap = Object.fromEntries(imgEntries.filter(([, v]) => v !== null)) as Record<string, string>;
//             const html = buildReportHTML(report, fieldMap, signaturePaths, imgMap);
//             const { uri } = await Print.printToFileAsync({ html, base64: false });
//             const canShare = await Sharing.isAvailableAsync();
//             if (canShare) {
//                 await Sharing.shareAsync(uri, {
//                     mimeType: "application/pdf",
//                     dialogTitle: `${report.title}.pdf`,
//                     UTI: "com.adobe.pdf",
//                 });
//             } else {
//                 Alert.alert("Sharing unavailable", "PDF was saved to: " + uri);
//             }
//         } catch (e: any) {
//             Alert.alert("Export failed", e?.message ?? "Could not generate PDF.");
//         } finally {
//             setExporting(false);
//         }
//     };

//     if (!report) {
//         return (
//             <View className="flex-1 bg-background items-center justify-center gap-3">
//                 <Ionicons name="document-outline" size={40} color="#3f3f46" />
//                 <Text className="text-zinc-500 text-sm">Report not found</Text>
//                 <TouchableOpacity onPress={() => onNavigate("reports")} className="mt-2">
//                     <Text className="text-primary text-sm font-semibold">Back to Reports</Text>
//                 </TouchableOpacity>
//             </View>
//         );
//     }

//     const statusCfg = STATUS_CFG[report.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.draft;
//     const scoreColor = !report.score ? "#52525b"
//         : report.score >= 80 ? "#22c55e"
//         : report.score >= 50 ? "#f2a72f"
//         : "#ef4444";

//     const completedSections = report.sections.filter(
//         (s) => s.status === "completed" || s.status === "partial",
//     ).length;


//     return (
//         <View className="flex-1 bg-background">
//             {/* Header */}
//             <View className="flex-row items-center justify-between px-5 pt-16 pb-4">
//                 <View className="flex-row items-center gap-3">
//                     <TouchableOpacity
//                         activeOpacity={0.7}
//                         onPress={() => onNavigate("reports")}
//                         className="w-9 h-9 items-center justify-center rounded-full bg-slate-800"
//                     >
//                         <Ionicons name="arrow-back" size={18} color="#ffffff" />
//                     </TouchableOpacity>
//                     <Text className="text-white text-lg font-bold" numberOfLines={1} style={{ maxWidth: 220 }}>
//                         {report.title}
//                     </Text>
//                 </View>
//                 <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: statusCfg.bg }}>
//                     <Text className="text-xs font-semibold" style={{ color: statusCfg.color }}>
//                         {statusCfg.label}
//                     </Text>
//                 </View>
//             </View>

//             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

//                 {/* ── Meta card ─────────────────────────────────────────── */}
//                 <View className="mx-5 bg-slate-900 rounded-2xl p-4 gap-3">
//                     <View className="flex-row items-start justify-between">
//                         <View className="flex-1 pr-3">
//                             <Text className="text-white text-base font-bold" numberOfLines={2}>
//                                 {report.title}
//                             </Text>
//                             <Text className="text-zinc-500 text-xs mt-0.5">
//                                 {report.templateName} · {fmtDate(report.createdAt)}
//                             </Text>
//                         </View>
//                         {/* Score ring */}
//                         <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: scoreColor, alignItems: "center", justifyContent: "center" }}>
//                             <Text style={{ color: scoreColor, fontSize: 16, fontWeight: "800", lineHeight: 18 }}>
//                                 {report.score ?? "—"}
//                             </Text>
//                             <Text style={{ color: scoreColor, fontSize: 8, fontWeight: "600" }}>/ 100</Text>
//                         </View>
//                     </View>

//                     {[
//                         { label: "Inspector", value: report.inspectorName },
//                         report.gps ? { label: "GPS", value: `${report.gps.lat.toFixed(5)}, ${report.gps.lng.toFixed(5)}` } : null,
//                         report.routeData ? { label: "Route", value: `${report.routeData.distanceKm} km · ${report.routeData.duration}` } : null,
//                         { label: "Created", value: fmtDate(report.createdAt) || "—" },
//                         { label: "Template version", value: report.templateVersion != null ? `v${report.templateVersion}` : "—" },
//                         report.checksum ? { label: "Checksum", value: report.checksum } : null,
//                         report.deviceHash ? { label: "Device hash", value: report.deviceHash } : null,
//                     ].filter(Boolean).map((row) => (
//                         <View key={row!.label} className="flex-row items-start justify-between border-t border-zinc-800 pt-2 gap-4">
//                             <Text className="text-zinc-500 text-xs shrink-0">{row!.label}</Text>
//                             <Text className="text-white text-xs font-medium text-right flex-1" numberOfLines={2}>{row!.value}</Text>
//                         </View>
//                     ))}
//                 </View>

//                 {/* ── Stats row ─────────────────────────────────────────── */}
//                 <View className="flex-row mx-5 mt-3 gap-2">
//                     {[
//                         { value: `${completedSections}/${report.sections.length}`, label: "Sections" },
//                         { value: String(report.photos.length),                      label: "Photos"   },
//                         { value: report.score != null ? `${report.score}%` : "—",  label: "Score"    },
//                     ].map((s) => (
//                         <View key={s.label} className="flex-1 bg-slate-900 rounded-2xl py-3 items-center">
//                             <Text className="text-white text-xl font-bold">{s.value}</Text>
//                             <Text className="text-zinc-500 text-xs mt-0.5">{s.label}</Text>
//                         </View>
//                     ))}
//                 </View>

//                 {/* ── Sections ──────────────────────────────────────────── */}
//                 <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mx-5 mt-4 mb-2">
//                     Sections
//                 </Text>

//                 <View className="mx-5 gap-2">
//                     {report.sections.map((sec) => {
//                         const cfg = SECTION_STATUS_CFG[sec.status] ?? SECTION_STATUS_CFG.notstarted;
//                         const isExpanded = expanded === sec.id;
//                         const isInactive = sec.status === "notstarted" || sec.status === "skipped";

//                         // Primary: photos from the Storage upload array
//                         const storedPhotos = photosBySec[sec.id] ?? [];
//                         const storedUris = storedPhotos.map((p) => p.url || p.localUri).filter(Boolean);

//                         // Fallback: scan every field value for photo-like objects (no template needed)
//                         const fieldUris = Object.values(sec.fieldValues)
//                             .flatMap(extractFieldPhotoUris)
//                             .filter((u) => !storedUris.includes(u)); // deduplicate

//                         const allPhotoUris = [...storedUris, ...fieldUris];

//                         // Collect displayable text fields (skip photo type — shown as thumbnails)
//                         const textFields = Object.entries(sec.fieldValues).filter(([fid, val]) => {
//                             const meta = fieldMap[fid];
//                             if (!meta || meta.type === "photo") return false;
//                             return formatFieldValue(meta.type, val) !== null;
//                         });

//                         return (
//                             <TouchableOpacity
//                                 key={sec.id}
//                                 activeOpacity={0.7}
//                                 onPress={() => setExpanded(isExpanded ? null : sec.id)}
//                                 className="bg-slate-900 rounded-2xl px-4 pt-3.5 pb-3.5"
//                             >
//                                 <View className="flex-row items-center">
//                                     <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: cfg.bg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
//                                         <Ionicons name={cfg.icon} size={14} color={cfg.color} />
//                                     </View>
//                                     <View className="flex-1">
//                                         <Text className={`text-sm font-semibold ${isInactive ? "text-zinc-500" : "text-white"}`}>
//                                             {sec.name}
//                                         </Text>
//                                         {!isInactive && (
//                                             <Text className="text-zinc-500 text-xs mt-0.5">
//                                                 {textFields.length} field{textFields.length !== 1 ? "s" : ""}
//                                                 {allPhotoUris.length > 0 ? ` · ${allPhotoUris.length} photo${allPhotoUris.length !== 1 ? "s" : ""}` : ""}
//                                                 {" · "}<Text style={{ color: cfg.color }}>{sec.status === "completed" ? "Completed" : sec.status === "partial" ? "Partial" : "In Progress"}</Text>
//                                             </Text>
//                                         )}
//                                     </View>
//                                     <Ionicons
//                                         name={isExpanded ? "chevron-up" : "chevron-down"}
//                                         size={16}
//                                         color="#52525b"
//                                     />
//                                 </View>

//                                 {/* Expanded content */}
//                                 {isExpanded && !isInactive && (
//                                     <View className="mt-3 pt-3 border-t border-zinc-800 gap-2.5">
//                                         {/* Field rows */}
//                                         {textFields.map(([fid, val]) => {
//                                             const meta = fieldMap[fid] ?? { label: fid, type: "text" as FieldType };
//                                             const display = formatFieldValue(meta.type, val);
//                                             if (!display) return null;
//                                             return (
//                                                 <View key={fid} className="flex-row gap-3 items-start">
//                                                     <Text className="text-zinc-500 text-xs w-28 shrink-0 pt-0.5 leading-relaxed" numberOfLines={2}>
//                                                         {meta.label}
//                                                     </Text>
//                                                     <Text className="text-zinc-200 text-xs flex-1 leading-relaxed">
//                                                         {display}
//                                                     </Text>
//                                                 </View>
//                                             );
//                                         })}

//                                         {/* Photo thumbnails */}
//                                         {allPhotoUris.length > 0 && (
//                                             <View className="flex-row flex-wrap gap-2 mt-1">
//                                                 {allPhotoUris.map((uri, pi) => (
//                                                     <Image
//                                                         key={uri + pi}
//                                                         source={{ uri }}
//                                                         style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: "#1e293b" }}
//                                                         resizeMode="cover"
//                                                     />
//                                                 ))}
//                                             </View>
//                                         )}

//                                         {textFields.length === 0 && allPhotoUris.length === 0 && (
//                                             <Text className="text-zinc-600 text-xs italic">No data recorded</Text>
//                                         )}
//                                     </View>
//                                 )}
//                             </TouchableOpacity>
//                         );
//                     })}
//                 </View>

//                 {/* ── Route card ────────────────────────────────────────── */}
//                 {report.routeData && (
//                     <View className="mx-5 mt-3 bg-slate-900 rounded-2xl p-4 gap-3">
//                         <View className="flex-row items-center gap-3">
//                             <View className="w-10 h-10 rounded-xl bg-primary/20 items-center justify-center">
//                                 <Ionicons name="map" size={20} color="#f2a72f" />
//                             </View>
//                             <Text className="text-white font-semibold text-sm">Route Summary</Text>
//                         </View>
//                         {[
//                             { label: "Distance",  value: `${report.routeData.distanceKm} km` },
//                             { label: "Duration",  value: report.routeData.duration },
//                             { label: "Waypoints", value: String(report.routeData.waypoints.length) },
//                             { label: "Stops",     value: String(report.routeData.markers) },
//                         ].map((row, i, arr) => (
//                             <View key={row.label} className={`flex-row justify-between ${i < arr.length - 1 ? "border-b border-zinc-800 pb-2" : ""}`}>
//                                 <Text className="text-zinc-500 text-xs">{row.label}</Text>
//                                 <Text className="text-white text-xs font-medium">{row.value}</Text>
//                             </View>
//                         ))}
//                     </View>
//                 )}

//                 {/* ── Signature ─────────────────────────────────────────── */}
//                 {signaturePaths && (
//                     <View className="mx-5 mt-3 bg-slate-900 rounded-2xl p-4 gap-3">
//                         <View className="flex-row items-center gap-2 mb-1">
//                             <Ionicons name="create-outline" size={16} color="#22c55e" />
//                             <Text className="text-white font-semibold text-sm">Signature</Text>
//                         </View>
//                         <SignatureDisplay paths={signaturePaths} />
//                     </View>
//                 )}
//             </ScrollView>

//             {/* ── Bottom actions ────────────────────────────────────────── */}
//             <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-zinc-800 px-5 pb-10 pt-3">
//                 <TouchableOpacity
//                     activeOpacity={0.8}
//                     onPress={handleExport}
//                     disabled={exporting}
//                     className="bg-slate-800 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
//                     style={exporting ? { opacity: 0.6 } : undefined}
//                 >
//                     {exporting
//                         ? <ActivityIndicator size="small" color="#ffffff" />
//                         : <Ionicons name="share-outline" size={16} color="#ffffff" />
//                     }
//                     <Text className="text-white font-semibold text-sm">
//                         {exporting ? "Exporting…" : "Export PDF"}
//                     </Text>
//                 </TouchableOpacity>
//             </View>
//         </View>
//     );
// }








import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Path, Svg } from "react-native-svg";

import { AppScreen } from "@/components/BottomNavBar";
import { getTemplate } from "@/lib/db/templates";
import { store } from "@/lib/store";
import { SYSTEM_TEMPLATES } from "@/lib/templates/systemTemplates";
import { FieldType, Report, ReportPhoto, Template } from "@/lib/types";
import { archiveReport } from "@/lib/db/reports"; // ← import archiveReport

interface Props {
    onNavigate: (screen: AppScreen) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// ... (Keep all helper functions like toMs, fmtDate, fmtDuration, extractFieldPhotoUris, etc. unchanged)

// ─── Status Configuration ──────────────────────────────────────────────────────
const STATUS_CFG = {
    draft:      { label: "Draft",       color: "#ffff5b", bg: "#ffff5b20" },
    completed:  { label: "Completed",   color: "#22c55e", bg: "#22c55e20" },
    inprogress: { label: "In Progress", color: "#44d2f9", bg: "#44d2f920" },
    archived:   { label: "Archived",    color: "#6b7280", bg: "#6b728020" }, // ← gray for archived
} as const;

const SECTION_STATUS_CFG = {
    completed:  { icon: "checkmark"            as const, color: "#22c55e", bg: "#22c55e20" },
    partial:    { icon: "remove"               as const, color: "#eab308", bg: "#eab30820" },
    inprogress: { icon: "ellipsis-horizontal"  as const, color: "#f2a72f", bg: "#f2a72f20" },
    skipped:    { icon: "remove"               as const, color: "#52525b", bg: "#3f3f4640" },
    notstarted: { icon: "remove"               as const, color: "#52525b", bg: "#3f3f4640" },
};

// ─── Signature Display ─────────────────────────────────────────────────────────
function sigViewBox(paths: string): string { /* keep unchanged */ }
function SignatureDisplay({ paths }: { paths: string }) { /* keep unchanged */ }

// ─── PDF export helpers ────────────────────────────────────────────────────────
async function fetchAsDataUri(uri: string): Promise<string | null> { /* keep unchanged */ }
function esc(s: unknown): string { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function buildReportHTML(report: Report, fieldMap: Record<string, { label: string; type: FieldType }>, signaturePaths: string | null, imgMap: Record<string, string> = {}): string { /* keep unchanged */ }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportDetailScreen({ onNavigate }: Props) {
    const report = store.selectedReport;
    const [template, setTemplate] = useState<Template | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [archiving, setArchiving] = useState(false); // new loading state for archiving

    // Load template
    useEffect(() => {
        if (!report) return;
        const sys = SYSTEM_TEMPLATES.find((t) => t.id === report.templateId);
        if (sys) { setTemplate(sys as unknown as Template); return; }
        getTemplate(report.templateId).then((t) => { if (t) setTemplate(t); });
    }, [report?.templateId]);

    const fieldMap = useMemo(() => {
        const map: Record<string, { label: string; type: FieldType }> = {};
        if (template) {
            for (const sec of template.sections) {
                for (const f of sec.fields) {
                    map[f.id] = { label: f.label, type: f.type };
                }
            }
        }
        return map;
    }, [template]);

    const photosBySec = useMemo(() => {
        const map: Record<string, ReportPhoto[]> = {};
        for (const p of (report?.photos ?? [])) {
            (map[p.sectionId] ??= []).push(p);
        }
        return map;
    }, [report]);

    const signaturePaths = report?.signatureUrl ?? null;

    const handleExport = async () => { /* keep unchanged */ }

    if (!report) {
        return (
            <View className="flex-1 bg-background items-center justify-center gap-3">
                <Ionicons name="document-outline" size={40} color="#3f3f46" />
                <Text className="text-zinc-500 text-sm">Report not found</Text>
                <TouchableOpacity onPress={() => onNavigate("reports")} className="mt-2">
                    <Text className="text-primary text-sm font-semibold">Back to Reports</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const statusCfg = STATUS_CFG[report.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.draft;
    const scoreColor = !report.score ? "#52525b"
        : report.score >= 80 ? "#22c55e"
        : report.score >= 50 ? "#f2a72f"
        : "#ef4444";

    const completedSections = report.sections.filter(
        (s) => s.status === "completed" || s.status === "partial",
    ).length;

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-16 pb-4">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => onNavigate("reports")}
                        className="w-9 h-9 items-center justify-center rounded-full bg-slate-800"
                    >
                        <Ionicons name="arrow-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <Text className="text-white text-lg font-bold" numberOfLines={1} style={{ maxWidth: 220 }}>
                        {report.title}
                    </Text>
                </View>
                <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: statusCfg.bg }}>
                    <Text className="text-xs font-semibold" style={{ color: statusCfg.color }}>
                        {statusCfg.label}
                    </Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
                {/* … existing meta card, sections, route, signature … unchanged */}
                {/* keep all previous code for sections, photos, route, signature unchanged */}
            </ScrollView>

            {/* Bottom actions */}
            <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-zinc-800 px-5 pb-10 pt-3 flex-col gap-2">
                {/* Export PDF */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleExport}
                    disabled={exporting}
                    className="bg-slate-800 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
                    style={exporting ? { opacity: 0.6 } : undefined}
                >
                    {exporting
                        ? <ActivityIndicator size="small" color="#ffffff" />
                        : <Ionicons name="share-outline" size={16} color="#ffffff" />
                    }
                    <Text className="text-white font-semibold text-sm">
                        {exporting ? "Exporting…" : "Export PDF"}
                    </Text>
                </TouchableOpacity>

                {/* Archive button (only if report is completed) */}
                {report.status === "completed" && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={async () => {
                            try {
                                setArchiving(true);
                                await archiveReport(report.id);
                                store.selectedReport = { ...report, status: "archived" };
                                Alert.alert("Success", "Report archived successfully");
                            } catch (err: any) {
                                Alert.alert("Failed", err.message ?? "Could not archive report");
                            } finally {
                                setArchiving(false);
                            }
                        }}
                        disabled={archiving}
                        className="bg-gray-700 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
                        style={archiving ? { opacity: 0.6 } : undefined}
                    >
                        {archiving
                            ? <ActivityIndicator size="small" color="#ffffff" />
                            : <Ionicons name="archive-outline" size={16} color="#ffffff" />
                        }
                        <Text className="text-white font-semibold text-sm">
                            {archiving ? "Archiving…" : "Archive Report"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}