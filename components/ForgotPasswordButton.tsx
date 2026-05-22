import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

import { getAuthErrorMessage, sendPasswordReset } from "@/lib/auth";

interface Props {
    /** Pre-fill the email input with whatever the user typed in the login form */
    email?: string;
}

export default function ForgotPasswordButton({ email = "" }: Props) {
    const [visible, setVisible] = useState(false);
    const [inputEmail, setInputEmail] = useState(email);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const open = () => {
        setInputEmail(email);
        setSent(false);
        setError(null);
        setVisible(true);
    };

    const close = () => {
        setVisible(false);
        setLoading(false);
    };

    const handleSend = async () => {
        if (!inputEmail.trim()) {
            setError("Please enter your email address.");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await sendPasswordReset(inputEmail);
            setSent(true);
        } catch (e) {
            setError(getAuthErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={open}
                className="self-end -mt-1"
            >
                <Text className="text-primary text-sm font-medium">
                    Forgot password?
                </Text>
            </TouchableOpacity>

            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={close}
            >
                {/* Dimmed backdrop — tap to dismiss */}
                <TouchableWithoutFeedback onPress={close}>
                    <View
                        style={{
                            flex: 1,
                            backgroundColor: "rgba(0,0,0,0.65)",
                            justifyContent: "flex-end",
                        }}
                    >
                        {/* Stop taps inside the sheet from closing the modal */}
                        <TouchableWithoutFeedback>
                            <KeyboardAvoidingView
                                behavior={
                                    Platform.OS === "ios" ? "padding" : "height"
                                }
                            >
                                <View
                                    style={{
                                        backgroundColor: "#0f172a",
                                        borderTopLeftRadius: 28,
                                        borderTopRightRadius: 28,
                                        paddingHorizontal: 24,
                                        paddingTop: 12,
                                        paddingBottom: 48,
                                    }}
                                >
                                    {/* Drag handle */}
                                    <View
                                        style={{
                                            width: 36,
                                            height: 4,
                                            borderRadius: 2,
                                            backgroundColor: "#334155",
                                            alignSelf: "center",
                                            marginBottom: 24,
                                        }}
                                    />

                                    {sent ? (
                                        /* ── Success state ── */
                                        <View className="items-center gap-4 py-4">
                                            <View className="w-16 h-16 rounded-full bg-green-500/20 items-center justify-center">
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={36}
                                                    color="#22c55e"
                                                />
                                            </View>
                                            <Text className="text-white text-lg font-bold text-center">
                                                Check your inbox
                                            </Text>
                                            <Text className="text-zinc-400 text-sm text-center leading-5">
                                                A password reset link has been sent to{" "}
                                                <Text className="text-primary font-medium">
                                                    {inputEmail.trim()}
                                                </Text>
                                                .
                                            </Text>
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={close}
                                                className="bg-primary rounded-2xl py-4 items-center mt-2 w-full"
                                            >
                                                <Text className="text-white font-bold text-base">
                                                    completed
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        /* ── Input state ── */
                                        <>
                                            <Text className="text-white text-xl font-bold mb-1">
                                                Reset password
                                            </Text>
                                            <Text className="text-zinc-400 text-sm mb-6 leading-5">
                                                Enter your account email and we'll send you a reset link.
                                            </Text>

                                            {/* Error banner */}
                                            {error && (
                                                <View className="bg-alert/15 border border-alert/40 rounded-2xl px-4 py-3 mb-4 flex-row items-center justify-between">
                                                    <Text className="text-alert text-sm flex-1">
                                                        {error}
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={() => setError(null)}
                                                    >
                                                        <Text className="text-alert text-lg leading-none ml-3">
                                                            ×
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}

                                            {/* Email input */}
                                            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-1.5 px-1">
                                                Email
                                            </Text>
                                            <View className="flex-row items-center bg-slate-700 rounded-2xl px-4 h-12 mb-5">
                                                <Text className="text-base mr-3 opacity-60">
                                                    ✉️
                                                </Text>
                                                <TextInput
                                                    value={inputEmail}
                                                    onChangeText={(v) => {
                                                        setInputEmail(v);
                                                        setError(null);
                                                    }}
                                                    placeholder="janedoe@example.com"
                                                    placeholderTextColor="#52525b"
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                    autoCorrect={false}
                                                    autoFocus
                                                    className="flex-1 text-white text-sm"
                                                />
                                            </View>

                                            {/* Send button */}
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={handleSend}
                                                disabled={loading}
                                                className={`rounded-2xl py-4 items-center ${
                                                    loading
                                                        ? "bg-primary/50"
                                                        : "bg-primary"
                                                }`}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator
                                                        color="#ffffff"
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Text className="text-white font-bold text-base">
                                                        Send reset link
                                                    </Text>
                                                )}
                                            </TouchableOpacity>

                                            {/* Cancel */}
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                onPress={close}
                                                className="items-center mt-4"
                                            >
                                                <Text className="text-zinc-500 text-sm">
                                                    Cancel
                                                </Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            </KeyboardAvoidingView>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </>
    );
}
