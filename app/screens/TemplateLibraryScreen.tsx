import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import AppHeader from "@/components/Header";
import BottomNavBar, { AppScreen } from "@/components/BottomNavBar";
import { listTemplates } from "@/lib/db/templates";
import { auth } from "@/lib/firebase";
import { store } from "@/lib/store";
import {
    CATEGORIES,
    SYSTEM_TEMPLATES,
    SystemTemplate,
} from "@/lib/templates/systemTemplates";
import { Template } from "@/lib/types";

interface Props {
    onNavigate: (screen: AppScreen) => void;
    onOpenSidebar: () => void;
    hasOrganisation: boolean;
}

export default function TemplateLibraryScreen({ onNavigate, onOpenSidebar,hasOrganisation }: Props) {
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [userTemplates, setUserTemplates] = useState<Template[]>([]);

    // Load user-created templates from Firestore
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        listTemplates(uid, null)
            .then(setUserTemplates)
            .catch(() => {}); // silently ignore — system templates still show
    }, []);

    const handleSelectSystem = (template: SystemTemplate) => {
        store.setSelectedTemplate(template.id);
        store.setSelectedUserTemplate(null);
        onNavigate("reportSetup");
    };

    const handleSelectUser = (template: Template) => {
        store.setSelectedTemplate(`user_${template.id}`);
        store.setSelectedUserTemplate(template);
        onNavigate("reportSetup");
    };

    // Filter system templates
    const filteredSystem = SYSTEM_TEMPLATES.filter((t) => {
        const matchSearch =
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.description.toLowerCase().includes(search.toLowerCase());
        const matchCat =
            activeCategory === "All" || t.category === activeCategory;
        return matchSearch && matchCat;
    });

    // Filter user templates
    const filteredUser = userTemplates.filter((t) => {
        const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
        const matchCat =
            activeCategory === "All" || t.category === activeCategory;
        return matchSearch && matchCat;
    });

    const hasResults = filteredSystem.length > 0 || filteredUser.length > 0;

    return (
        <View className="flex-1 bg-background">
            {/* Header */}
            <AppHeader onOpenSidebar={onOpenSidebar} onNavigate={onNavigate}  active="templateLibrary" />
            <View className="flex-row items-center justify-between px-5 pt-5 pb-4">
                <View>
                    <Text className="text-white text-2xl font-bold">
                        Templates
                    </Text>
                    <Text className="text-zinc-400 text-sm mt-0.5">
                        {SYSTEM_TEMPLATES.length} system
                        {userTemplates.length > 0
                            ? ` · ${userTemplates.length} custom`
                            : ""}
                    </Text>
                </View>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onNavigate("templateBuilder")}
                    className="flex-row items-center gap-2 bg-primary/15 border border-primary/30 px-3 py-2 rounded-xl"
                >
                    <Ionicons name="add" size={16} color="#f2a72f" />
                    <Text className="text-primary text-sm font-semibold">
                        Create
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View className="mx-5 mb-4">
                <View className="flex-row items-center bg-slate-900 rounded-2xl px-4 h-11 gap-2">
                    <Ionicons name="search-outline" size={18} color="#52525b" />
                    <TextInput
                        className="flex-1 text-white text-sm"
                        placeholder="Search templates…"
                        placeholderTextColor="#52525b"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearch("")}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="close-circle"
                                size={18}
                                color="#52525b"
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Category pills */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    alignItems: "flex-start",
                }}
            >
                <View className="flex-row gap-2">
                    {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            activeOpacity={0.7}
                            onPress={() => setActiveCategory(cat)}
                            className={`py-2 rounded-xl items-center border ${
                                activeCategory === cat
                                    ? "bg-primary border-primary"
                                    : "bg-slate-900 border-zinc-700"
                            }`}
                            style={{ minWidth: 82 }}
                        >
                            <Text
                                className={`text-sm font-medium ${
                                    activeCategory === cat
                                        ? "text-white"
                                        : "text-zinc-400"
                                }`}
                            >
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* Template lists */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                }}
            >
                {!hasResults && (
                    <View className="items-center py-16">
                        <Ionicons
                            name="search-outline"
                            size={40}
                            color="#52525b"
                        />
                        <Text className="text-zinc-500 text-sm mt-3">
                            No templates match "{search}"
                        </Text>
                    </View>
                )}

                {/* ── System templates ───────────────────────── */}
                {filteredSystem.length > 0 && (
                    <View className="mb-5">
                        {(filteredUser.length > 0 ||
                            userTemplates.length > 0) && (
                            <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">
                                System templates
                            </Text>
                        )}
                        <View className="gap-3">
                            {filteredSystem.map((template) => (
                                <TouchableOpacity
                                    key={template.id}
                                    activeOpacity={0.75}
                                    onPress={() => handleSelectSystem(template)}
                                    className="bg-slate-900 rounded-2xl p-4"
                                >
                                    <View className="flex-row items-center mb-3">
                                        <View
                                            className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                                            style={{
                                                backgroundColor:
                                                    template.color + "28",
                                            }}
                                        >
                                            <Ionicons
                                                name={template.icon as any}
                                                size={22}
                                                color={template.color}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-white font-semibold text-sm">
                                                {template.name}
                                            </Text>
                                            <View className="flex-row items-center gap-2 mt-0.5">
                                                <View
                                                    className="px-2 py-0.5 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            template.color +
                                                            "28",
                                                    }}
                                                >
                                                    <Text
                                                        className="text-xs font-medium"
                                                        style={{
                                                            color: template.color,
                                                        }}
                                                    >
                                                        {template.category}
                                                    </Text>
                                                </View>
                                                <Text className="text-zinc-600 text-xs">
                                                    {template.sections.length}{" "}
                                                    sections
                                                </Text>
                                                {template.gpsValidation && (
                                                    <View className="flex-row items-center gap-0.5">
                                                        <Ionicons
                                                            name="location"
                                                            size={10}
                                                            color="#52525b"
                                                        />
                                                        <Text className="text-zinc-600 text-xs">
                                                            GPS
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <Ionicons
                                            name="chevron-forward"
                                            size={16}
                                            color="#3f3f46"
                                        />
                                    </View>
                                    <Text className="text-zinc-400 text-xs leading-relaxed mb-3">
                                        {template.description}
                                    </Text>
                                    <View className="flex-row flex-wrap gap-1.5">
                                        {template.features.map((feat) => (
                                            <View
                                                key={feat}
                                                className="bg-slate-800 px-2.5 py-1 rounded-full"
                                            >
                                                <Text className="text-zinc-400 text-xs">
                                                    {feat}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── User templates ─────────────────────────── */}
                {filteredUser.length > 0 && (
                    <View>
                        <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">
                            My templates
                        </Text>
                        <View className="gap-3">
                            {filteredUser.map((template) => (
                                <TouchableOpacity
                                    key={template.id}
                                    activeOpacity={0.75}
                                    onPress={() => handleSelectUser(template)}
                                    className="bg-slate-900 rounded-2xl p-4 flex-row items-center"
                                >
                                    <View className="w-11 h-11 rounded-xl bg-slate-800 items-center justify-center mr-3">
                                        <Ionicons
                                            name="document-outline"
                                            size={20}
                                            color="#94a3b8"
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-semibold text-sm">
                                            {template.name}
                                        </Text>
                                        <View className="flex-row items-center gap-2 mt-0.5">
                                            <View className="bg-zinc-800 px-2 py-0.5 rounded-full">
                                                <Text className="text-zinc-400 text-xs">
                                                    {template.category}
                                                </Text>
                                            </View>
                                            <Text className="text-zinc-600 text-xs">
                                                {template.sections.length}{" "}
                                                sections
                                            </Text>
                                            <View className="bg-primary/15 px-2 py-0.5 rounded-full">
                                                <Text className="text-primary text-xs font-medium">
                                                    Custom
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={16}
                                        color="#3f3f46"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Create CTA when no user templates yet */}
                {userTemplates.length === 0 && filteredSystem.length > 0 && (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => onNavigate("templateBuilder")}
                        className="mt-4 border border-dashed border-zinc-700 rounded-2xl py-4 items-center flex-row justify-center gap-2"
                    >
                        <Ionicons
                            name="add-circle-outline"
                            size={18}
                            color="#52525b"
                        />
                        <Text className="text-zinc-500 text-sm">
                            Create a custom template
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <BottomNavBar active="templateLibrary" onNavigate={onNavigate} hasOrganisation={hasOrganisation}/>
        </View>
    );
}
