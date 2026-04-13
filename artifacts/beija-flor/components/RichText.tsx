import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;

type Block =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "bullet"; text: string }
  | { type: "checkbox"; checked: boolean; text: string }
  | { type: "text"; text: string }
  | { type: "empty" };

function parseLine(line: string): Block {
  if (line.startsWith("# ")) return { type: "heading", text: line.slice(2) };
  if (line.startsWith("## ")) return { type: "subheading", text: line.slice(3) };
  if (line.startsWith("• ") || line.startsWith("- ")) return { type: "bullet", text: line.slice(2) };
  if (line.startsWith("[x] ") || line.startsWith("[X] ")) return { type: "checkbox", checked: true, text: line.slice(4) };
  if (line.startsWith("[ ] ")) return { type: "checkbox", checked: false, text: line.slice(4) };
  if (line.trim() === "") return { type: "empty" };
  return { type: "text", text: line };
}

function InlineBold({ text, baseStyle }: { text: string; baseStyle?: any }) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return (
    <Text style={baseStyle}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <Text key={i} style={[baseStyle, { fontFamily: "Inter_700Bold" }]}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

export function RichText({ content, baseSize = 13 }: { content: string; baseSize?: number }) {
  const lines = content.split("\n");
  const blocks = lines.map(parseLine);

  const body = { fontSize: baseSize, fontFamily: "Inter_400Regular", color: C.text, lineHeight: baseSize * 1.55 };
  const headingStyle = { fontSize: baseSize + 2, fontFamily: "Inter_700Bold", color: C.text, marginTop: 8, marginBottom: 2 };
  const subStyle = { fontSize: baseSize + 1, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginTop: 4 };

  return (
    <View style={{ gap: 2 }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <Text key={i} style={headingStyle}>{block.text}</Text>
            );
          case "subheading":
            return (
              <Text key={i} style={subStyle}>{block.text}</Text>
            );
          case "bullet":
            return (
              <View key={i} style={st.bulletRow}>
                <View style={[st.bullet, { marginTop: (body.lineHeight - 6) / 2 }]} />
                <InlineBold text={block.text} baseStyle={body} />
              </View>
            );
          case "checkbox":
            return (
              <View key={i} style={st.checkRow}>
                <View style={[st.checkCircle, block.checked && st.checkCircleFilled]}>
                  {block.checked && <Feather name="check" size={9} color="#fff" />}
                </View>
                <InlineBold text={block.text} baseStyle={[body, block.checked && st.checkedText]} />
              </View>
            );
          case "empty":
            return <View key={i} style={{ height: 6 }} />;
          default:
            return (
              <InlineBold key={i} text={block.text} baseStyle={body} />
            );
        }
      })}
    </View>
  );
}

const st = StyleSheet.create({
  bulletRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
  },
  bullet: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: C.tint, flexShrink: 0, marginTop: 6,
  },
  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
  },
  checkCircle: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 2,
  },
  checkCircleFilled: {
    backgroundColor: "#059669", borderColor: "#059669",
  },
  checkedText: {
    textDecorationLine: "line-through", color: C.textMuted,
  },
});
