import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { colors, font, radius, spacing, type, shadow } from "@/src/theme/theme";
import { api } from "@/src/api/client";
import { ensurePlayer } from "@/src/store/player";
import { playSound } from "@/src/audio/sounds";
import { speak } from "@/src/audio/speech";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "How do I get more strikes?",
  "What is the best time to use the bomb?",
  "How does scoring work?",
  "Tips for picking up spares?",
];

export default function Coach() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sessionId = useRef<string>("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const p = await ensurePlayer();
      sessionId.current = p.id;
      try {
        const hist = await api.aiChatHistory(p.id);
        if (hist?.length) {
          setMessages(hist.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
        }
      } catch (e) {}
    })();
  }, []);

  const scrollToEnd = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || sending || !sessionId.current) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);
    scrollToEnd();
    try {
      const r = await api.aiChat({ session_id: sessionId.current, message: msg });
      setMessages((m) => [...m, { role: "assistant", content: r?.text || "…" }]);
      playSound("tap");
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "My headset cut out — try again!" }]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  return (
    <View style={styles.container}>
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="coach-back-button" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <View style={styles.coachAvatar}>
            <Ionicons name="school" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Coach Luna</Text>
            <Text style={styles.headerSub}>Your AI bowling pro</Text>
          </View>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          {messages.length === 0 && (
            <Animated.View entering={FadeInUp} style={styles.welcome}>
              <View style={styles.welcomeAvatar}>
                <Ionicons name="school" size={30} color="#fff" />
              </View>
              <Text style={styles.welcomeTitle}>Hey, I{"'"}m Coach Luna! 🎳</Text>
              <Text style={styles.welcomeText}>
                Ask me anything about bowling technique, scoring, or how to master the power-ups.
              </Text>
            </Animated.View>
          )}

          {messages.map((m, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.duration(220)}
              style={[styles.row, m.role === "user" ? styles.rowUser : styles.rowAI]}
            >
              {m.role === "assistant" && (
                <View style={styles.bubbleAvatar}>
                  <Ionicons name="school" size={14} color="#fff" />
                </View>
              )}
              <View style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAI]}>
                <Text style={[styles.bubbleText, m.role === "user" && styles.bubbleTextUser]}>
                  {m.content}
                </Text>
                {m.role === "assistant" && (
                  <Pressable
                    onPress={() => speak(m.content)}
                    style={styles.speakBubbleBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="volume-high" size={15} color={colors.brandPrimary} />
                    <Text style={styles.speakBubbleText}>Hear it</Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          ))}

          {sending && (
            <View style={[styles.row, styles.rowAI]}>
              <View style={styles.bubbleAvatar}>
                <Ionicons name="school" size={14} color="#fff" />
              </View>
              <View style={[styles.bubble, styles.bubbleAI, styles.typing]}>
                <ActivityIndicator size="small" color={colors.brandPrimary} />
                <Text style={styles.typingText}>Luna is thinking…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* suggestion chips */}
        {messages.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
          >
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.chip} onPress={() => send(s)}>
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            testID="coach-input"
            style={styles.input}
            placeholder="Ask Coach Luna…"
            placeholderTextColor={colors.onSurfaceSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            multiline
          />
          <Pressable
            testID="coach-send-button"
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitleWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  coachAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: font.display, fontSize: type.lg, color: colors.onSurface },
  headerSub: { fontFamily: font.text, fontSize: type.sm, color: colors.onSurfaceSecondary },
  messages: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  welcome: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing["2xl"] },
  welcomeAvatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  welcomeTitle: { fontFamily: font.display, fontSize: type.xl, color: colors.onSurface },
  welcomeText: {
    fontFamily: font.text,
    fontSize: type.base,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs, maxWidth: "100%" },
  rowUser: { justifyContent: "flex-end" },
  rowAI: { justifyContent: "flex-start" },
  bubbleAvatar: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: { maxWidth: "80%", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleUser: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: colors.surfaceSecondary, borderBottomLeftRadius: 4, ...shadow.card },
  bubbleText: { fontFamily: font.text, fontSize: type.base, color: colors.onSurface, lineHeight: 21 },
  bubbleTextUser: { color: "#fff" },
  speakBubbleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
    alignSelf: "flex-start",
  },
  speakBubbleText: { fontFamily: font.display, fontSize: type.sm, color: colors.brandPrimary },
  typing: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  typingText: { fontFamily: font.text, fontSize: type.base, color: colors.onSurfaceSecondary },
  chips: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm, alignItems: "center" },
  chipsScroll: { flexGrow: 0 },
  chip: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { fontFamily: font.text, fontSize: type.sm, color: colors.onSurface },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontFamily: font.text,
    fontSize: type.base,
    color: colors.onSurface,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
