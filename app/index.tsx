import "./global.css";

import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { AppScreen } from "@/components/BottomNavBar";

import { useAuth } from "@/hooks/useAuth";

import { getUserOrganisation } from "@/lib/db/organisations";
import { store } from "@/lib/store";
import { trackingStore } from "@/lib/trackingStore";

import HomeScreen from "./screens/HomeScreen";
import LoginRegisterScreen from "./screens/LoginRegisterScreen";
import MapsRoutesScreen from "./screens/MapsRoutesScreen";
import NotificationScreen from "./screens/NotificationScreen";
import OrganisationScreen from "./screens/OrganisationScreen";
import PermissionsScreen from "./screens/PermissionsScreen";
import ReportComparisonScreen from "./screens/ReportComparisonScreen";
import ReportDetailScreen from "./screens/ReportDetailScreen";
import ReportEditorScreen from "./screens/ReportEditorScreen";
import ReportListScreen from "./screens/ReportListScreen";
import ReportPreviewScreen from "./screens/ReportPreviewScreen";
import ReportSetupScreen from "./screens/ReportSetupScreen";
import ScoreScreen from "./screens/ScoreScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SharedReportsScreen from "./screens/SharedReportsScreen";
import TemplateBuilderScreen from "./screens/TemplateBuilderScreen";
import TemplateLibraryScreen from "./screens/TemplateLibraryScreen";

import Sidebar from "./screens/SideBar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TIMING = {
    duration: 420,
    easing: Easing.out(Easing.cubic),
};

function ScreenContent({
    screen,
    navigate,
    openSidebar,
    hasOrganisation,
    userId,
    currentOrgId,
    onOrgSwitch,
}: {
    screen: AppScreen;
    navigate: (s: AppScreen) => void;
    openSidebar: () => void;
    hasOrganisation: boolean;
    userId?: string;
    currentOrgId?: string | null;
    onOrgSwitch?: (orgId: string) => void;
}) {
    switch (screen) {
        case "permissions":
            return (
                <PermissionsScreen
                    onNavigate={navigate}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "reports":
            return (
                <ReportListScreen
                    onNavigate={navigate}
                    onOpenSidebar={openSidebar}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "templateLibrary":
            return (
                <TemplateLibraryScreen
                    onNavigate={navigate}
                    onOpenSidebar={openSidebar}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "templateBuilder":
            return (
                <TemplateBuilderScreen
                    onNavigate={navigate}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "reportSetup":
            return (
                <ReportSetupScreen
                    onNavigate={navigate}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "reportEditor":
            return (
                <ReportEditorScreen
                    onNavigate={navigate}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "mapsRoutes":
            return (
                <MapsRoutesScreen
                    onNavigate={navigate}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "reportPreview":
            return (
                <ReportPreviewScreen
                    onNavigate={navigate}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "score":
            return (
                <ScoreScreen
                    onNavigate={navigate}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "reportDetail":
            return <ReportDetailScreen onNavigate={navigate} />;

        case "reportComparison":
            return (
                <ReportComparisonScreen
                    onNavigate={navigate}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "settings":
            return (
                <SettingsScreen
                    onNavigate={navigate}
                    onOpenSidebar={openSidebar}
                    hasOrganisation={hasOrganisation}
                />
            );

        case "organisation":
            return (
                <OrganisationScreen
                    onNavigate={navigate}
                    onOpenSidebar={openSidebar}
                    hasOrganisation={hasOrganisation}
                    onOrgSwitch={onOrgSwitch}
                />
            );

        case "notification":
            return (
                <NotificationScreen
                    onNavigate={navigate}
                    onOpenSidebar={openSidebar}
                    hasOrganisation={hasOrganisation}
                    userId={userId}
                />
            );

        case "sharedReports":
        case "sharedTemplates":
            return (
                <SharedReportsScreen
                    onNavigate={navigate}
                    onOpenSidebar={openSidebar}
                    hasOrganisation={hasOrganisation}
                    currentOrgId={currentOrgId ?? null}
                />
            );

        default:
            return (
                <HomeScreen
                    onNavigate={navigate}
                    onOpenSidebar={openSidebar}
                    hasOrganisation={hasOrganisation}
                />
            );
    }
}

export default function App() {
    const { user, loading } = useAuth();

    // current screen
    const [currentScreen, setCurrentScreen] =
        useState<AppScreen>("home");

    // animated incoming screen
    const [incomingScreen, setIncomingScreen] =
        useState<AppScreen | null>(null);

    // sidebar
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [hasOrganisation, setHasOrganisation] = useState(false);
    const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

    const pendingPermissions = useRef(false);

    const historyRef = useRef<AppScreen[]>(["home"]);

    const incomingX = useSharedValue(SCREEN_WIDTH);

    const incomingStyle = useAnimatedStyle(() => ({
        ...StyleSheet.absoluteFillObject,
        transform: [{ translateX: incomingX.value }],
    }));

    const finishTransition = (target: AppScreen) => {
        setCurrentScreen(target);
        setIncomingScreen(null);
    };

    const navigate = (target: AppScreen) => {
        // Drop the call if we're already on this screen or mid-transition
        if (target === currentScreen || incomingScreen !== null) return;

        const REPORT_SCREENS: AppScreen[] = [
            "reportSetup",
            "reportEditor",
            "reportPreview",
        ];

        if (
            REPORT_SCREENS.includes(currentScreen) &&
            !REPORT_SCREENS.includes(target)
        ) {
            store.clearReport();

            trackingStore.cancelRoute();
            trackingStore.cancelAccel();
            trackingStore.cancelTimer();
        }

        const history = historyRef.current;

        const existingIdx = history.lastIndexOf(target);

        const isBack =
            existingIdx !== -1 &&
            existingIdx < history.length - 1;

        if (isBack) {
            historyRef.current = history.slice(
                0,
                existingIdx + 1
            );
        } else {
            historyRef.current = [...history, target];
        }

        incomingX.value = isBack
            ? -SCREEN_WIDTH
            : SCREEN_WIDTH;

        setIncomingScreen(target);

        incomingX.value = withTiming(
            0,
            TIMING,
            (finished) => {
                if (finished) {
                    runOnJS(finishTransition)(target);
                }
            }
        );
    };

    // auth navigation
    useEffect(() => {
        if (!user) {
            pendingPermissions.current = false;
            return;
        }

        setIncomingScreen(null);

        if (pendingPermissions.current) {
            pendingPermissions.current = false;

            historyRef.current = ["permissions"];

            setCurrentScreen("permissions");
        } else {
            historyRef.current = ["home"];

            setCurrentScreen("home");
        }
    }, [user?.uid]);

    // organisation check
    useEffect(() => {
        if (!user?.uid) {
            setHasOrganisation(false);
            return;
        }

        (async () => {
            try {
                const orgs = await getUserOrganisation(user.uid);
                const hasOrg = Array.isArray(orgs) && orgs.length > 0;
                setHasOrganisation(hasOrg);
                if (hasOrg) {
                    const orgId = store.currentOrgId ?? orgs[0].id;
                    store.setCurrentOrgId(orgId);
                    setCurrentOrgId(orgId);
                }
            } catch (e) {
                console.warn("Failed to load organisations", e);
            }
        })();
    }, [user?.uid]);

    // loading
    if (loading) {
        return (
            <View className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator
                    color="#f2a72f"
                    size="large"
                />
            </View>
        );
    }

    // auth screen
    if (!user) {
        return (
            <LoginRegisterScreen
                onStartRegister={() => {
                    pendingPermissions.current = true;
                }}
            />
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {/* Main Screen */}
            <ScreenContent
                screen={currentScreen}
                navigate={navigate}
                openSidebar={() => setSidebarOpen(true)}
                hasOrganisation={hasOrganisation}
                userId={user.uid}
                currentOrgId={currentOrgId}
                onOrgSwitch={setCurrentOrgId}
            />

            {/* Transition Screen */}
            {incomingScreen !== null && (
                <Animated.View style={incomingStyle}>
                    <ScreenContent
                        screen={incomingScreen}
                        navigate={navigate}
                        openSidebar={() => setSidebarOpen(true)}
                        hasOrganisation={hasOrganisation}
                        userId={user.uid}
                        currentOrgId={currentOrgId}
                        onOrgSwitch={setCurrentOrgId}
                    />
                </Animated.View>
            )}

            {/* Sidebar */}
            {sidebarOpen && (
                <>
                    {/* Overlay */}
                    <TouchableOpacity
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor:
                                "rgba(0,0,0,0.3)",
                            zIndex: 998,
                        }}
                        activeOpacity={1}
                        onPress={() =>
                            setSidebarOpen(false)
                        }
                    />

                    {/* Sidebar Panel */}
                    <View
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: 300,
                            zIndex: 999,

                            shadowColor: "#000",
                            shadowOpacity: 0.3,
                            shadowOffset: {
                                width: 0,
                                height: 2,
                            },
                            shadowRadius: 10,
                        }}
                    >
                        <Sidebar
                            active={currentScreen}
                            onNavigate={(screen) => {
                                setSidebarOpen(false);
                                navigate(screen);
                            }}
                            onSignOut={() => setSidebarOpen(false)}
                            onOrgSwitch={(orgId) => setCurrentOrgId(orgId)}
                        />
                    </View>
                </>
            )}
        </View>
    );
}