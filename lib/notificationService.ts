import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { NotificationDB } from "@/lib/db/notifications";

// Show notifications even when app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export async function registerForPushNotificationsAsync(): Promise<void> {
    // Android push notification channels are unsupported in Expo Go since SDK 53.
    // Skip channel setup in that environment — local/scheduled notifications still work.
    if (Platform.OS === "android" && !isExpoGo) {
        await Notifications.setNotificationChannelAsync("default", {
            name: "FieldReportX",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#f2a72f",
        });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== "granted") {
        await Notifications.requestPermissionsAsync();
    }
}

// ── In-progress reminder ──────────────────────────────────────────────────────

const INPROGRESS_ID = "fieldreportx-inprogress-reminder";

async function scheduleInProgressReminder(count: number): Promise<void> {
    // Cancel any existing reminder before rescheduling
    await Notifications.cancelScheduledNotificationAsync(INPROGRESS_ID).catch(() => {});

    await Notifications.scheduleNotificationAsync({
        identifier: INPROGRESS_ID,
        content: {
            title: "Report in progress",
            body: `You have ${count} report${count !== 1 ? "s" : ""} in progress. Tap to continue.`,
            sound: true,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 7200, // 2 hours
            repeats: true,
        } as any,
    });
}

async function cancelInProgressReminder(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(INPROGRESS_ID).catch(() => {});
}

// ── Firestore listeners ───────────────────────────────────────────────────────

// Track what we've already notified about so we don't double-fire
const _notifiedInvites = new Set<string>();
const _notifiedTemplates = new Set<string>();

/**
 * Watches Firestore for new in-progress reports and keeps the 2-hour local
 * reminder in sync. Returns an unsubscribe function.
 */
export function subscribeInProgressReports(userId: string): () => void {
    const q = query(
        collection(db, "reports"),
        where("inspectorId", "==", userId),
        where("status", "==", "inprogress"),
    );

    return onSnapshot(q, async (snap) => {
        const count = snap.size;
        if (count > 0) {
            await scheduleInProgressReminder(count);
        } else {
            await cancelInProgressReminder();
        }
    }, () => { /* ignore listener errors */ });
}

/**
 * Watches for new pending org invites for the user, fires an OS notification
 * and writes a Firestore notification record for each new invite.
 * Returns an unsubscribe function.
 */
export function subscribeOrgInviteNotifications(userId: string): () => void {
    const q = query(
        collection(db, "organisationInvites"),
        where("invitedUid", "==", userId),
        where("status", "==", "pending"),
    );

    let seeded = false;

    return onSnapshot(q, async (snap) => {
        if (!seeded) {
            // Seed existing invite IDs — don't fire for ones already present
            snap.docs.forEach((d) => _notifiedInvites.add(d.id));
            seeded = true;
            return;
        }

        for (const change of snap.docChanges()) {
            if (change.type !== "added") continue;
            if (_notifiedInvites.has(change.doc.id)) continue;
            _notifiedInvites.add(change.doc.id);

            const data = change.doc.data();
            const body = `You've been invited to join ${data.orgName}.`;

            await Notifications.scheduleNotificationAsync({
                content: { title: "Organisation invite", body, sound: true },
                trigger: null,
            });

            await NotificationDB.create(userId, {
                title: "Organisation invite",
                description: body,
                icon: "business-outline",
                unread: true,
                inviteId: change.doc.id,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }).catch(() => {});
        }
    }, () => {});
}

/**
 * Watches for new templates created within the user's organisation, fires an
 * OS notification and writes a Firestore notification record for each.
 * Returns an unsubscribe function.
 */
export function subscribeOrgTemplateNotifications(
    userId: string,
    orgId: string,
): () => void {
    const q = query(
        collection(db, "templates"),
        where("organisationId", "==", orgId),
    );

    let seeded = false;

    return onSnapshot(q, async (snap) => {
        if (!seeded) {
            snap.docs.forEach((d) => _notifiedTemplates.add(d.id));
            seeded = true;
            return;
        }

        for (const change of snap.docChanges()) {
            if (change.type !== "added") continue;
            if (_notifiedTemplates.has(change.doc.id)) continue;
            _notifiedTemplates.add(change.doc.id);

            const data = change.doc.data();
            const body = `"${data.name}" has been added to your organisation.`;

            await Notifications.scheduleNotificationAsync({
                content: { title: "New template available", body, sound: true },
                trigger: null,
            });

            await NotificationDB.create(userId, {
                title: "New template available",
                description: body,
                icon: "document-text-outline",
                unread: true,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }).catch(() => {});
        }
    }, () => {});
}
