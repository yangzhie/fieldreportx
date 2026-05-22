import { Timestamp } from "firebase/firestore";

// ─── User ────────────────────────────────────────────────────────────────────

export interface UserProfile {
    uid: string;
    displayName: string;
    email: string;
    organisationId: string | null;
    role: "admin" | "inspector" | "viewer";
    onboardingComplete: boolean;
    createdAt: number; // Unix ms — stored in SQLite, written to Firestore as a number
}

// ─── Organisation ─────────────────────────────────────────────────────────────

export interface Organisation {
    id: string;
    name: string;
    abn?: string;
    address?: string;
    adminUid: string;
    memberUids: string[];
    createdAt: number; // Unix ms
}

// ─── Template ─────────────────────────────────────────────────────────────────

export type FieldType =
    | "text"
    | "number"
    | "checkbox"
    | "select"
    | "photo"
    | "signature"
    | "route"
    | "accelerometer"
    | "timer"
    | "stopwatch"
    | "joint_angle";

export interface TemplateField {
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
    options?: string[]; // used when type === 'select'
    gyroCapture?: boolean; // capture device angle/alignment when photo is taken
}

export interface TemplateSection {
    id: string;
    name: string;
    fields: TemplateField[];
}

export interface Template {
    id: string;
    name: string;
    category: string;
    createdBy: string; // userId
    organisationId: string | null;
    sections: TemplateSection[];
    gpsValidation: boolean;
    version: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export type ReportStatus = "draft" | "inprogress" | "completed";
export type SectionStatus = "notstarted" | "inprogress" | "partial" | "completed" | "skipped";

export interface Annotation {
    type: "text" | "arrow" | "circle" | "draw";
    x: number;
    y: number;
    text?: string;
}

export interface ReportPhoto {
    id: string;
    url: string; // Firebase Storage URL (populated after upload)
    localUri: string; // local device path before upload
    sectionId: string;
    gps: { lat: number; lng: number } | null;
    annotations: Annotation[];
    capturedAt: Timestamp;
}

export interface ReportSection {
    id: string;
    name: string;
    status: SectionStatus;
    fieldValues: Record<string, string | boolean | number>;
    notes: string;
    photoIds: string[];
    score: number | null;
}

export interface RouteData {
    distanceKm: number;
    duration: string; // e.g. "00:12:34"
    waypoints: { lat: number; lng: number }[];
    markers: number;
}

export interface Report {
    id: string;
    title: string;
    templateId: string;
    templateName: string;
    templateVersion?: number;
    organisationId: string | null;
    inspectorId: string;
    inspectorName: string;
    status: ReportStatus;
    score: number | null;
    gps: { lat: number; lng: number } | null;
    routeData: RouteData | null;
    signatureUrl: string | null;
    checksum?: string;
    deviceHash?: string;
    sections: ReportSection[];
    photos: ReportPhoto[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
