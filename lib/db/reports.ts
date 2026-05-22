// import {
//     collection,
//     deleteDoc,
//     doc,
//     getDoc,
//     getDocs,
//     query,
//     serverTimestamp,
//     setDoc,
//     updateDoc,
//     where,
// } from "firebase/firestore";

// import { db } from "@/lib/firebase";
// import { Report, ReportPhoto, ReportSection, ReportStatus } from "@/lib/types";

// const col = "reports";

// export async function createReport(
//     data: Pick<
//         Report,
//         | "title"
//         | "templateId"
//         | "templateName"
//         | "organisationId"
//         | "inspectorId"
//         | "inspectorName"
//         | "sections"
//         | "gps"
//     >,
// ): Promise<string> {
//     const ref = doc(collection(db, col));
//     await setDoc(ref, {
//         ...data,
//         id: ref.id,
//         status: "draft" as ReportStatus,
//         score: null,
//         routeData: null,
//         signatureUrl: null,
//         photos: [],
//         createdAt: serverTimestamp(),
//         updatedAt: serverTimestamp(),
//     });
//     return ref.id;
// }

// export async function getReport(reportId: string): Promise<Report | null> {
//     const snap = await getDoc(doc(db, col, reportId));
//     return snap.exists() ? (snap.data() as Report) : null;
// }

// export async function listReportsByUser(uid: string): Promise<Report[]> {
//     const q = query(collection(db, col), where("inspectorId", "==", uid));
//     const snap = await getDocs(q);
//     return snap.docs.map((d) => d.data() as Report);
// }

// export async function listReportsByOrg(orgId: string): Promise<Report[]> {
//     const q = query(collection(db, col), where("organisationId", "==", orgId));
//     const snap = await getDocs(q);
//     return snap.docs.map((d) => d.data() as Report);
// }

// export async function updateReport(
//     reportId: string,
//     data: Partial<
//         Pick<
//             Report,
//             "title" | "status" | "score" | "routeData" | "signatureUrl" | "gps"
//         >
//     >,
// ): Promise<void> {
//     await updateDoc(doc(db, col, reportId), {
//         ...data,
//         updatedAt: serverTimestamp(),
//     });
// }

// export async function updateReportSection(
//     reportId: string,
//     updatedSection: ReportSection,
// ): Promise<void> {
//     const snap = await getDoc(doc(db, col, reportId));
//     const sections: ReportSection[] = snap.data()?.sections ?? [];
//     const next = sections.map((s) =>
//         s.id === updatedSection.id ? updatedSection : s,
//     );
//     await updateDoc(doc(db, col, reportId), {
//         sections: next,
//         updatedAt: serverTimestamp(),
//     });
// }

// export async function addPhotoToReport(
//     reportId: string,
//     photo: ReportPhoto,
// ): Promise<void> {
//     const snap = await getDoc(doc(db, col, reportId));
//     const photos: ReportPhoto[] = snap.data()?.photos ?? [];
//     await updateDoc(doc(db, col, reportId), {
//         photos: [...photos, photo],
//         updatedAt: serverTimestamp(),
//     });
// }

// export async function updateReportStatus(
//     reportId: string,
//     status: ReportStatus,
// ): Promise<void> {
//     await updateDoc(doc(db, col, reportId), {
//         status,
//         updatedAt: serverTimestamp(),
//     });
// }

// export async function deleteReport(reportId: string): Promise<void> {
//     await deleteDoc(doc(db, col, reportId));
// }







import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Report, ReportPhoto, ReportSection, ReportStatus } from "@/lib/types";

const col = "reports";

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createReport(
    data: Pick<
        Report,
        | "title"
        | "templateId"
        | "templateName"
        | "organisationId"
        | "inspectorId"
        | "inspectorName"
        | "sections"
        | "gps"
    >,
): Promise<string> {
    const ref = doc(collection(db, col));
    await setDoc(ref, {
        ...data,
        id: ref.id,
        status: "draft" as ReportStatus,
        score: null,
        routeData: null,
        signatureUrl: null,
        photos: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

// ─── Read ─────────────────────────────────────────────────────────────────────
export async function getReport(reportId: string): Promise<Report | null> {
    const snap = await getDoc(doc(db, col, reportId));
    return snap.exists() ? (snap.data() as Report) : null;
}

export async function listReportsByUser(uid: string): Promise<Report[]> {
    const q = query(collection(db, col), where("inspectorId", "==", uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Report);
}

export async function listReportsByOrg(orgId: string): Promise<Report[]> {
    const q = query(collection(db, col), where("organisationId", "==", orgId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Report);
}

// ─── Update ───────────────────────────────────────────────────────────────────
export async function updateReport(
    reportId: string,
    data: Partial<
        Pick<
            Report,
            "title" | "status" | "score" | "routeData" | "signatureUrl" | "gps"
        >
    >,
): Promise<void> {
    await updateDoc(doc(db, col, reportId), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

export async function updateReportSection(
    reportId: string,
    updatedSection: ReportSection,
): Promise<void> {
    const snap = await getDoc(doc(db, col, reportId));
    const sections: ReportSection[] = snap.data()?.sections ?? [];
    const next = sections.map((s) =>
        s.id === updatedSection.id ? updatedSection : s,
    );
    await updateDoc(doc(db, col, reportId), {
        sections: next,
        updatedAt: serverTimestamp(),
    });
}

export async function addPhotoToReport(
    reportId: string,
    photo: ReportPhoto,
): Promise<void> {
    const snap = await getDoc(doc(db, col, reportId));
    const photos: ReportPhoto[] = snap.data()?.photos ?? [];
    await updateDoc(doc(db, col, reportId), {
        photos: [...photos, photo],
        updatedAt: serverTimestamp(),
    });
}

export async function updateReportStatus(
    reportId: string,
    status: ReportStatus,
): Promise<void> {
    await updateDoc(doc(db, col, reportId), {
        status,
        updatedAt: serverTimestamp(),
    });
}

// ─── Archive ──────────────────────────────────────────────────────────────────
export async function archiveReport(reportId: string): Promise<void> {
    const snap = await getDoc(doc(db, col, reportId));
    const report = snap.data() as Report | undefined;
    if (!report) throw new Error("Report not found");
    if (report.status !== "completed") throw new Error("Only completed reports can be archived");

    await updateDoc(doc(db, col, reportId), {
        status: "archived",
        updatedAt: serverTimestamp(),
    });
}

// ─── Delete ───────────────────────────────────────────────────────────────────
export async function deleteReport(reportId: string): Promise<void> {
    await deleteDoc(doc(db, col, reportId));
}