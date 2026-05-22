import { Ionicons } from "@expo/vector-icons";
import { Camera } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import * as Sharing from "expo-sharing";
import { DeviceMotion } from "expo-sensors";
import { Audio } from "expo-av";
import React, { useEffect, useState } from "react";
import AppHeader from "@/components/Header";
import {
    Alert,
    Linking,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import BottomNavBar, { AppScreen } from "@/components/BottomNavBar";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import {
    createOrganisation,
    getUserOrganisation,
    leaveOrganisation,
    makeAdmin,
} from "@/lib/db/organisations";
import { listReportsByUser } from "@/lib/db/reports";
import { listTemplates } from "@/lib/db/templates";
import { sqliteDb } from "@/lib/db/database";
import { getUserProfile } from "@/lib/db/users";
import { store } from "@/lib/store";

interface Props {
    onNavigate: (screen: AppScreen) => void;
    onOpenSidebar: () => void;
    hasOrganisation: boolean;
}

const Toggle = ({ value, onPress }: { value: boolean; onPress: () => void }) => (
    <TouchableOpacity
        onPress={onPress}
        className={`w-12 h-6 rounded-full ${value ? "bg-primary" : "bg-slate-700"}`}
    >
        <View
            style={{ left: value ? 28 : 4 }}
            className="w-4 h-4 rounded-full bg-white absolute top-1"
        />
    </TouchableOpacity>
);

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function SettingsScreen({ onNavigate, onOpenSidebar, hasOrganisation }: Props) {
    const user = auth.currentUser;

    const [localStorageUsed, setLocalStorageUsed] = useState<string>("—");

    useEffect(() => {
        (async () => {
            try {
                const dbPath = `${FileSystem.documentDirectory}SQLite/fieldreportx.db`;
                const info = await FileSystem.getInfoAsync(dbPath, { size: true });
                if (info.exists && !info.isDirectory && (info as any).size != null) {
                    setLocalStorageUsed(formatBytes((info as any).size));
                } else {
                    setLocalStorageUsed("0 B");
                }
            } catch {
                setLocalStorageUsed("—");
            }
        })();
    }, []);

    const [exporting, setExporting] = useState(false);

    const handleExportBackup = async () => {
        if (!user?.uid) return;
        setExporting(true);
        try {
            const [reports, templates] = await Promise.all([
                listReportsByUser(user.uid),
                listTemplates(user.uid, null),
            ]);

            const cachedUsers = sqliteDb.getAllSync("SELECT * FROM users") ?? [];
            const cachedOrgs  = sqliteDb.getAllSync("SELECT * FROM organisations") ?? [];

            const payload = {
                exportedAt: new Date().toISOString(),
                version: "1.0",
                userId: user.uid,
                reports,
                templates,
                localCache: { users: cachedUsers, organisations: cachedOrgs },
            };

            const filename = `fieldreportx_backup_${Date.now()}.json`;
            const path = `${FileSystem.cacheDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2), {
                encoding: FileSystem.EncodingType.UTF8,
            });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(path, {
                    mimeType: "application/json",
                    dialogTitle: filename,
                    UTI: "public.json",
                });
            } else {
                Alert.alert("Backup saved", `File written to:\n${path}`);
            }
        } catch (e: any) {
            Alert.alert("Export failed", e?.message ?? "Could not create backup.");
        } finally {
            setExporting(false);
        }
    };

    // Org state
    const [currentOrg, setCurrentOrg] = useState<any | null>(null);
    const [orgModalVisible, setOrgModalVisible] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [creatingOrg, setCreatingOrg] = useState(false);

    useEffect(() => {
        if (!user?.uid) return;
        getUserOrganisation(user.uid).then((orgs) => {
            const active = orgs.find((o) => o.id === store.currentOrgId) ?? orgs[0] ?? null;
            setCurrentOrg(active);
        });
    }, [user?.uid]);

    const handleCreateOrg = async () => {
        if (!newOrgName.trim() || !user?.uid) return;
        setCreatingOrg(true);
        try {
            const orgId = await createOrganisation(user.uid, { name: newOrgName.trim() });
            store.setCurrentOrgId(orgId);
            const orgs = await getUserOrganisation(user.uid);
            setCurrentOrg(orgs.find((o) => o.id === orgId) ?? null);
            setNewOrgName("");
            setOrgModalVisible(false);
            Alert.alert("Organisation created", `"${newOrgName.trim()}" is ready.`);
        } catch {
            Alert.alert("Error", "Failed to create organisation.");
        } finally {
            setCreatingOrg(false);
        }
    };

    const handleLeaveOrg = async () => {
        if (!currentOrg || !user?.uid) return;
        const isAdmin = currentOrg.adminUid === user.uid;
        const otherMembers = (currentOrg.memberUids as string[]).filter((id: string) => id !== user.uid);

        if (isAdmin && otherMembers.length > 0) {
            Alert.alert(
                "Transfer admin first",
                "You're the admin. Please make another member admin in the Organisation tab before leaving.",
            );
            return;
        }

        Alert.alert(
            `Leave "${currentOrg.name}"`,
            "Are you sure? You will lose access to shared resources.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Leave",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await leaveOrganisation(currentOrg.id, user.uid);
                            store.setCurrentOrgId(null);
                            setCurrentOrg(null);
                        } catch {
                            Alert.alert("Error", "Failed to leave organisation.");
                        }
                    },
                },
            ],
        );
    };

    // Real permission status (granted / not-granted)
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
    const [motionEnabled, setMotionEnabled] = useState(false);

    useEffect(() => {
        Camera.getCameraPermissionsAsync().then(({ status }) =>
            setCameraEnabled(status === "granted"),
        );
        Location.getForegroundPermissionsAsync().then(({ status }) =>
            setLocationEnabled(status === "granted"),
        );
        Audio.getPermissionsAsync().then(({ status }) =>
            setMicrophoneEnabled(status === "granted"),
        );
        if (Platform.OS === "ios") {
            DeviceMotion.getPermissionsAsync().then(({ status }) =>
                setMotionEnabled(status === "granted"),
            );
        }
    }, []);

    // Permissions can't be revoked programmatically — open system settings instead
    const openPermissionSettings = () => Linking.openSettings();

    // Notifications
    const [reportReminderEnabled, setReportReminderEnabled] = useState(true);
    const [templateUpdatesEnabled, setTemplateUpdatesEnabled] = useState(true);

    // Storage
    const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);

    // Sign out
    const [signingOut, setSigningOut] = useState(false);

    const initials = user?.displayName
        ? user.displayName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
        : "?";

    const handleSignOut = () => {
        Alert.alert("Sign out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Sign out",
                style: "destructive",
                onPress: async () => {
                    setSigningOut(true);
                    try {
                        await signOut();
                    } catch {
                        setSigningOut(false);
                        Alert.alert(
                            "Error",
                            "Failed to sign out. Please try again.",
                        );
                    }
                },
            },
        ]);
    };

    return (
        <View className="flex-1 bg-background">
            <AppHeader onOpenSidebar={onOpenSidebar} onNavigate={onNavigate} active="settings" />
            {/* Header */}
            <View className="px-5 pt-5 pb-4">
                <Text className="text-white text-2xl font-bold">Settings</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
            >
                {/* Profile card */}
                <View className="mx-5 bg-slate-900 rounded-2xl p-4 flex-row items-center gap-4">
                    <View className="w-14 h-14 rounded-full bg-primary items-center justify-center">
                        <Text className="text-white text-lg font-bold">
                            {initials}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-white font-semibold text-base">
                            {user?.displayName ?? "—"}
                        </Text>
                        <Text className="text-zinc-500 text-sm mt-0.5">
                            {user?.email ?? "—"}
                        </Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.7}>
                        <Ionicons
                            name="pencil-outline"
                            size={18}
                            color="#71717a"
                        />
                    </TouchableOpacity>
                </View>

                {/* Permissions */}
                <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mx-5 mt-5 mb-2">
                    Permissions
                </Text>
                <View className="mx-5 bg-slate-900 rounded-2xl px-4">
                    {[
                        { label: "Camera", value: cameraEnabled, onPress: openPermissionSettings },
                        { label: "Location (GPS)", value: locationEnabled, onPress: openPermissionSettings },
                        { label: "Microphone", value: microphoneEnabled, onPress: openPermissionSettings },
                        { label: "Motion sensors", value: motionEnabled, onPress: openPermissionSettings },
                    ].map((item, i, arr) => (
                        <View
                            key={item.label}
                            className={`flex-row items-center justify-between py-4 ${
                                i < arr.length - 1 ? "border-b border-zinc-800" : ""
                            }`}
                        >
                            <Text className="text-white text-sm">{item.label}</Text>
                            <Toggle value={item.value} onPress={item.onPress} />
                        </View>
                    ))}
                </View>

                {/* Notifications */}
                <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mx-5 mt-5 mb-2">
                    Notifications
                </Text>
                <View className="mx-5 bg-slate-900 rounded-2xl px-4">
                    {[
                        { label: "Report reminders", value: reportReminderEnabled, onPress: () => setReportReminderEnabled((v) => !v) },
                        { label: "Template updates", value: templateUpdatesEnabled, onPress: () => setTemplateUpdatesEnabled((v) => !v) },
                    ].map((item, i, arr) => (
                        <View
                            key={item.label}
                            className={`flex-row items-center justify-between py-4 ${
                                i < arr.length - 1 ? "border-b border-zinc-800" : ""
                            }`}
                        >
                            <Text className="text-white text-sm">{item.label}</Text>
                            <Toggle value={item.value} onPress={item.onPress} />
                        </View>
                    ))}
                </View>

                {/* Storage & Data */}
                <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mx-5 mt-5 mb-2">
                    Storage &amp; Data
                </Text>
                <View className="mx-5 bg-slate-900 rounded-2xl px-4">
                    <View className="flex-row items-center justify-between py-4 border-b border-zinc-800">
                        <Text className="text-white text-sm">Cloud sync</Text>
                        <Toggle
                            value={cloudSyncEnabled}
                            onPress={() => setCloudSyncEnabled((v) => !v)}
                        />
                    </View>
                    <View className="flex-row items-center justify-between py-4 border-b border-zinc-800">
                        <Text className="text-white text-sm">Local storage used</Text>
                        <Text className="text-zinc-400 text-sm">{localStorageUsed}</Text>
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={exporting}
                        onPress={handleExportBackup}
                        className="py-4 flex-row items-center justify-between"
                    >
                        <Text className="text-white text-sm">Export &amp; backup data</Text>
                        {exporting && <Ionicons name="hourglass-outline" size={16} color="#f2a72f" />}
                    </TouchableOpacity>
                </View>

                {/* About */}
                <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mx-5 mt-5 mb-2">
                    About
                </Text>
                <View className="mx-5 bg-slate-900 rounded-2xl px-4">
                    <View className="flex-row items-center justify-between py-4 border-b border-zinc-800">
                        <Text className="text-white text-sm">App version</Text>
                        <Text className="text-zinc-400 text-sm">1.0.0</Text>
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between py-4"
                    >
                        <Text className="text-white text-sm">Terms &amp; privacy policy</Text>
                        <Ionicons name="chevron-forward" size={16} color="#3f3f46" />
                    </TouchableOpacity>
                </View>

                {/* Organisation */}
                <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mx-5 mt-5 mb-2">
                    Organisation
                </Text>
                <View className="mx-5 bg-slate-900 rounded-2xl px-4">
                    {currentOrg ? (
                        <>
                            <View className="flex-row items-center justify-between py-4 border-b border-zinc-800">
                                <Text className="text-white text-sm">Current org</Text>
                                <Text className="text-zinc-400 text-sm">{currentOrg.name}</Text>
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleLeaveOrg}
                                className="py-4"
                            >
                                <Text className="text-red-400 text-sm">Leave "{currentOrg.name}"</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setOrgModalVisible(true)}
                            className="flex-row items-center justify-between py-4"
                        >
                            <Text className="text-white text-sm">Create Organisation</Text>
                            <Ionicons name="chevron-forward" size={16} color="#3f3f46" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Sign out */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleSignOut}
                    disabled={signingOut}
                    className="mx-5 mt-5 bg-alert/10 border border-alert/30 rounded-2xl py-4 flex-row items-center justify-center gap-2"
                >
                    <Ionicons name="log-out-outline" size={18} color="#f93a3a" />
                    <Text className="text-alert font-semibold text-sm">
                        {signingOut ? "Signing out…" : "Sign out"}
                    </Text>
                </TouchableOpacity>

                {/* Create Org Modal */}
                <Modal visible={orgModalVisible} transparent animationType="fade">
                    <View className="flex-1 bg-black/70 justify-center px-6">
                        <View className="bg-slate-900 rounded-2xl p-5">
                            <Text className="text-white font-bold text-base mb-4">Create Organisation</Text>
                            <TextInput
                                placeholder="Organisation name"
                                placeholderTextColor="#52525b"
                                value={newOrgName}
                                onChangeText={setNewOrgName}
                                className="bg-slate-800 text-white px-4 py-3 rounded-xl mb-4"
                            />
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => { setOrgModalVisible(false); setNewOrgName(""); }}
                                    className="flex-1 py-3 rounded-xl bg-slate-800 items-center"
                                >
                                    <Text className="text-zinc-400 font-semibold">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleCreateOrg}
                                    disabled={creatingOrg || !newOrgName.trim()}
                                    className="flex-1 py-3 rounded-xl bg-primary items-center"
                                    style={(!newOrgName.trim() || creatingOrg) ? { opacity: 0.5 } : undefined}
                                >
                                    <Text className="text-white font-semibold">
                                        {creatingOrg ? "Creating…" : "Create"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>

            <BottomNavBar active="settings" onNavigate={onNavigate} hasOrganisation={hasOrganisation}/>
        </View>
    );
}
