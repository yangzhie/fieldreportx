import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { db as firestoreDb } from "@/lib/firebase";
import { UserProfile } from "@/lib/types";
import { sqliteDb } from "./database";

const col = "users";

// SQLite row shape — booleans are 0/1, arrays are JSON strings
type SQLiteUser = {
    uid: string;
    displayName: string;
    email: string;
    organisationId: string | null;
    role: string;
    onboardingComplete: number;
    createdAt: number;
};

function fromRow(row: SQLiteUser): UserProfile {
    return {
        uid: row.uid,
        displayName: row.displayName,
        email: row.email,
        organisationId: row.organisationId ?? null,
        role: row.role as UserProfile["role"],
        onboardingComplete: row.onboardingComplete === 1,
        createdAt: row.createdAt,
    };
}

// Firestore may have stored a Timestamp object from earlier serverTimestamp() calls.
// Normalise to Unix ms so we always work with numbers.
function toMs(value: unknown): number {
    if (typeof value === "number") return value;
    if (value && typeof (value as any).toMillis === "function")
        return (value as any).toMillis();
    return Date.now();
}

async function cacheUser(profile: UserProfile): Promise<void> {
    await sqliteDb.runAsync(
        `INSERT OR REPLACE INTO users
         (uid, displayName, email, organisationId, role, onboardingComplete, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            profile.uid,
            profile.displayName,
            profile.email,
            profile.organisationId,
            profile.role,
            profile.onboardingComplete ? 1 : 0,
            profile.createdAt,
        ],
    );
}

// Called immediately after Firebase Auth sign-up
export async function createUserProfile(
    uid: string,
    displayName: string,
    email: string,
): Promise<void> {
    const profile: UserProfile = {
        uid,
        displayName,
        email: email.toLowerCase(),
        organisationId: null,
        role: "inspector",
        onboardingComplete: false,
        createdAt: Date.now(),
    };
    await setDoc(doc(firestoreDb, col, uid), profile);
    await cacheUser(profile);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    // SQLite first — instant, works offline
    const cached = await sqliteDb.getFirstAsync<SQLiteUser>(
        "SELECT * FROM users WHERE uid = ?",
        [uid],
    );
    if (cached) return fromRow(cached);

    // Firestore fallback — normalise timestamps on the way in
    const snap = await getDoc(doc(firestoreDb, col, uid));
    if (!snap.exists()) return null;

    const raw = snap.data();
    const profile: UserProfile = {
        uid: raw.uid,
        displayName: raw.displayName,
        email: raw.email,
        organisationId: raw.organisationId ?? null,
        role: raw.role,
        onboardingComplete: raw.onboardingComplete ?? false,
        createdAt: toMs(raw.createdAt),
    };
    await cacheUser(profile);
    return profile;
}

export async function updateUserProfile(
    uid: string,
    data: Partial<
        Pick<
            UserProfile,
            "displayName" | "organisationId" | "role" | "onboardingComplete"
        >
    >,
): Promise<void> {
    // Source of truth update
    await updateDoc(doc(firestoreDb, col, uid), data);

    // Merge into SQLite cache
    const cached = await sqliteDb.getFirstAsync<SQLiteUser>(
        "SELECT * FROM users WHERE uid = ?",
        [uid],
    );
    if (cached) {
        const merged: UserProfile = { ...fromRow(cached), ...data };
        await cacheUser(merged);
    }
}
