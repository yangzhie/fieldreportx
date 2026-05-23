import { FirebaseError } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile,
} from "firebase/auth";

import { auth } from "./firebase";
import { createUserProfile, getUserProfile } from "./db/users";

export async function signIn(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    // Upsert profile so users who registered before the users collection existed are discoverable
    const existing = await getUserProfile(credential.user.uid);
    if (!existing) {
        await createUserProfile(
            credential.user.uid,
            credential.user.displayName ?? email.trim(),
            (credential.user.email ?? email.trim()).toLowerCase(),
        );
    }
}

export async function signUp(
    name: string,
    email: string,
    password: string,
): Promise<void> {
    const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
    );
    await updateProfile(credential.user, { displayName: name.trim() });
    // Always store email as lowercase so invite-by-email lookups are case-insensitive
    await createUserProfile(credential.user.uid, name.trim(), email.trim().toLowerCase());
}

export async function sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim());
}

export async function signOut(): Promise<void> {
    await firebaseSignOut(auth);
}

export function getAuthErrorMessage(error: unknown): string {
    if (!(error instanceof FirebaseError)) return "An unexpected error occurred.";
    switch (error.code) {
        case "auth/email-already-in-use":
            return "An account with this email already exists.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/weak-password":
            return "Password must be at least 6 characters.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Incorrect email or password.";
        case "auth/too-many-requests":
            return "Too many failed attempts. Please try again later.";
        case "auth/network-request-failed":
            return "No internet connection. Check your network and retry.";
        default:
            return "Authentication failed. Please try again.";
    }
}
