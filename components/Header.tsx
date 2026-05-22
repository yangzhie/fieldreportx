

// import { Ionicons } from "@expo/vector-icons";
// import React, { useRef, useMemo, useEffect, useState } from "react";
// import { Text, TouchableOpacity, View } from "react-native";

// import { AppScreen } from "@/components/BottomNavBar";
// import { auth } from "@/lib/firebase";
// import { NotificationDB, NotificationItem } from "@/lib/db/notifications";

// interface HeaderProps {
//     onOpenSidebar: () => void;
//     onNavigate: (screen: AppScreen) => void;
//     profileInitials?: string;
//     active?: AppScreen;
// }

// function getInitials(name?: string | null, email?: string | null) {
//     if (name && name.trim().length > 0) {
//         return name
//             .trim()
//             .split(" ")
//             .map((n) => n[0])
//             .join("")
//             .toUpperCase()
//             .slice(0, 2);
//     }

//     if (email) return email[0].toUpperCase();

//     return "U";
// }

// export default function AppHeader({
//     onOpenSidebar,
//     onNavigate,
//     profileInitials,
//     active,
// }: HeaderProps) {
//     const user = auth.currentUser;
//     const lastNav = useRef(0);
//     const [notifications, setNotifications] = useState<NotificationItem[]>([]);

//     // Subscribe to notifications
//     useEffect(() => {
//         if (!user?.uid) return;
//         const unsubscribe = NotificationDB.subscribe(user.uid, setNotifications);
//         return unsubscribe;
//     }, [user]);

//     const initials = useMemo(() => {
//         if (profileInitials) return profileInitials.toUpperCase();
//         return getInitials(user?.displayName, user?.email);
//     }, [profileInitials, user]);

//     const safeNavigate = (screen: AppScreen) => {
//         if (active === screen) return;
//         const now = Date.now();
//         if (now - lastNav.current < 500) return;
//         lastNav.current = now;
//         onNavigate(screen);
//     };

//     const hasUnread = notifications.some((n) => n.unread);

//     return (
//         <View className="flex-row items-center justify-between px-5 pt-12 pb-5 bg-slate-900">
//             {/* LEFT: Sidebar */}
//             <TouchableOpacity
//                 activeOpacity={0.7}
//                 onPress={onOpenSidebar}
//                 className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
//             >
//                 <Ionicons name="menu" size={22} color="#ffffff" />
//             </TouchableOpacity>

//             {/* RIGHT: Actions */}
//             <View className="flex-row items-center gap-3">
//                 <TouchableOpacity
//                     activeOpacity={0.7}
//                     className="w-9 h-9 items-center justify-center rounded-full bg-slate-800"
//                     onPress={() => safeNavigate("notification")}
//                 >
//                     <Ionicons
//                         name="notifications-outline"
//                         size={20}
//                         color="#f2a72f"
//                     />
//                     {hasUnread && (
//                         <View className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
//                     )}
//                 </TouchableOpacity>

//                 <TouchableOpacity
//                     activeOpacity={0.8}
//                     onPress={() => safeNavigate("settings")}
//                     className="w-10 h-10 rounded-full bg-primary items-center justify-center"
//                 >
//                     <Text className="text-white font-bold text-sm">
//                         {initials}
//                     </Text>
//                 </TouchableOpacity>
//             </View>
//         </View>
//     );
// }





import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useMemo, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { AppScreen } from "@/components/BottomNavBar";
import { auth } from "@/lib/firebase";
import { NotificationDB, NotificationItem } from "@/lib/db/notifications";

interface HeaderProps {
  onOpenSidebar: () => void;
  onNavigate: (screen: AppScreen) => void;
  profileInitials?: string;
  active?: AppScreen;
}

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim().length > 0) {
    return name
      .trim()
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) return email[0].toUpperCase();
  return "U";
}

function TopNotification({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onClose}
      className="absolute top-[80px] left-0 right-0 bg-yellow-400 px-5 py-3 z-50"
    >
      <Text className="text-black font-bold">{message}</Text>
    </TouchableOpacity>
  );
}

export default function AppHeader({
  onOpenSidebar,
  onNavigate,
  profileInitials,
  active,
}: HeaderProps) {
  const user = auth.currentUser;
  const lastNav = useRef(0);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [topNotification, setTopNotification] = useState<NotificationItem | null>(null);

  // Track IDs we have already seen
  const seenNotificationIds = useRef<Set<string>>(new Set());

  // Subscribe to notifications
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = NotificationDB.subscribe(user.uid, (items) => {
      if (!Array.isArray(items)) return;

      setNotifications(items);

      // Only consider notifications with valid IDs
      const safeItems = items.filter((n) => n.id);

      // Get truly new notifications
      const newNotifications = safeItems.filter(
        (n) => !seenNotificationIds.current.has(n.id)
      );

      if (newNotifications.length > 0) {
        // Mark them as seen
        newNotifications.forEach((n) => seenNotificationIds.current.add(n.id));
        // Show only the latest new notification
        setTopNotification(newNotifications[0]);
      }
    });

    return unsubscribe;
  }, [user]);

  const initials = useMemo(() => {
    if (profileInitials) return profileInitials.toUpperCase();
    return getInitials(user?.displayName, user?.email);
  }, [profileInitials, user]);

  const safeNavigate = (screen: AppScreen) => {
    if (active === screen) return;
    const now = Date.now();
    if (now - lastNav.current < 500) return;
    lastNav.current = now;
    onNavigate(screen);
  };

  const hasUnread = notifications.some((n) => n.unread);

  return (
    <View className="bg-slate-900">
      <View className="flex-row items-center justify-between px-5 pt-12 pb-5">
        {/* LEFT: Sidebar */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onOpenSidebar}
          className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
        >
          <Ionicons name="menu" size={22} color="#ffffff" />
        </TouchableOpacity>

        {/* RIGHT: Actions */}
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            activeOpacity={0.7}
            className="w-9 h-9 items-center justify-center rounded-full bg-slate-800"
            onPress={() => safeNavigate("notification")}
          >
            <View className="relative">
              <Ionicons name="notifications-outline" size={20} color="#f2a72f" />
              {hasUnread && (
                <View className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => safeNavigate("settings")}
            className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          >
            <Text className="text-white font-bold text-sm">{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top notification banner */}
      {topNotification && (
        <TopNotification
          message={topNotification.title}
          onClose={() => setTopNotification(null)}
        />
      )}
    </View>
  );
}