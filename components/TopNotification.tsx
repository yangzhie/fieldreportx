import React, { useEffect, useState } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";

interface TopNotificationProps {
  message: string;
  duration?: number; // ms to auto-hide
  onClose?: () => void;
}

export default function TopNotification({ message, duration = 4000, onClose }: TopNotificationProps) {
  const [visible] = useState(new Animated.Value(0));

  useEffect(() => {
    // Slide in
    Animated.timing(visible, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-hide
    const timer = setTimeout(() => {
      Animated.timing(visible, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onClose?.());
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const translateY = visible.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 0], // slide down from above
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        transform: [{ translateY }],
        backgroundColor: "#f2a72f",
        padding: 12,
        zIndex: 999,
      }}
    >
      <TouchableOpacity onPress={() => onClose?.()}>
        <Text style={{ color: "#000", fontWeight: "bold" }}>{message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}