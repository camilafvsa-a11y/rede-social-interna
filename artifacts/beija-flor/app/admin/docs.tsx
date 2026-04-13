import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Switch, Platform, KeyboardAvoidingView, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

// ─── Types ────────────────────────────────────────────────────────────────────
type IntegraItem = {
  id: number;
  category: string;
  sectionName: string | null;
  sectionIcon: string | null;
  sectionColor: string | null;
  sectionColorBg: string | null;
  title: string;
  subtitle: string | null;
  content: string | null;
  pdfUrl: string | null;
  requiresSign: boolean;
  requiresRead: boolean;
  docKey: string;
  iconName: string | null;
  sortOrder: number;
  isActive: boolean;
  docType: string;
  showInIntegra: boolean;
  showInOnboarding: boolean;
  countsForProgress: boolean;
  createdAt: string;
  updatedAt: string;
};

type SectionDef = {
  sectionName: string;
  sectionIcon: string | null;
  sectionColor: string | null;
  sectionColorBg: string | null;
  count: number;
};

type FormState = {
  title: string;
  subtitle: string;
  category: string;
  sectionName: string;
  sectionIcon: string | null;
  sectionColor: string;
  sectionColorBg: string;
  iconName: string | null;
  docType: string;
  content: string;
  pdfUrl: string;
  requiresSign: boolean;
  requiresRead: boolean;
  countsForProgress: boolean;
  showInIntegra: boolean;
  showInOnboarding: boolean;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  title: "", subtitle: "", category: "conduct",
  sectionName: "", sectionIcon: "shield", sectionColor: "#2563EB", sectionColorBg: "#EFF6FF",
  iconName: "file-text", docType: "text", content: "", pdfUrl: "",
  requiresSign: false, requiresRead: true, countsForProgress: true,
  showInIntegra: true, showInOnboarding: true,
  sortOrder: "0", isActive: true,
};

function itemToForm(item: IntegraItem): FormState {
  return {
    title: item.title,
    subtitle: item.subtitle || "",
    category: item.category,
    sectionName: item.sectionName || "",
    sectionIcon: item.sectionIcon || null,
    sectionColor: item.sectionColor || "#2563EB",
    sectionColorBg: item.sectionColorBg || "#EFF6FF",
    iconName: item.iconName || null,
    docType: item.docType || "text",
    content: item.content || "",
    pdfUrl: item.pdfUrl || "",
    requiresSign: item.requiresSign,
    requiresRead: item.requiresRead,
    countsForProgress: item.countsForProgress,
    showInIntegra: item.showInIntegra,
    showInOnboarding: item.showInOnboarding,
    sortOrder: String(item.sortOrder),
    isActive: item.isActive,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SECTION_COLORS = [
  "#2563EB", "#1D4ED8", "#1E40AF", "#7C3AED", "#6D28D9",
  "#059669", "#047857", "#DC2626", "#B91C1C", "#D97706",
  "#DB2777", "#0D9488", "#0891B2", "#374151", "#C2410C",
];

const BG_COLORS = [
  "#EFF6FF", "#E0E7FF", "#F5F3FF", "#EDE9FE", "#ECFDF5",
  "#FEF2F2", "#FFFBEB", "#FFF1F2", "#F0FDFA", "#E0F2FE",
  "#F9FAFB", "#F1F5F9", "#FEF9C3", "#F7FEE7", "#FFF7ED",
];

const ICON_LIST: { name: string | null; label: string }[] = [
  { name: null, label: "Nenhum" },
  { name: "file-text", label: "Documento" },
  { name: "file", label: "Arquivo" },
  { name: "book", label: "Livro" },
  { name: "book-open", label: "Leitura" },
  { name: "clipboard", label: "Prancheta" },
  { name: "archive", label: "Pasta" },
  { name: "folder", label: "Diretório" },
  { name: "user", label: "Usuário" },
  { name: "users", label: "Equipe" },
  { name: "user-check", label: "Aprovado" },
  { name: "briefcase", label: "Maleta" },
  { name: "shield", label: "Escudo" },
  { name: "shield-off", label: "Sem escudo" },
  { name: "lock", label: "Cadeado" },
  { name: "unlock", label: "Aberto" },
  { name: "key", label: "Chave" },
  { name: "alert-triangle", label: "Aviso" },
  { name: "alert-circle", label: "Alerta" },
  { name: "alert-octagon", label: "Proibido" },
  { name: "info", label: "Informação" },
  { name: "help-circle", label: "Ajuda" },
  { name: "message-square", label: "Mensagem" },
  { name: "message-circle", label: "Chat" },
  { name: "mail", label: "E-mail" },
  { name: "phone", label: "Telefone" },
  { name: "bar-chart-2", label: "Gráfico" },
  { name: "trending-up", label: "Tendência" },
  { name: "dollar-sign", label: "Financeiro" },
  { name: "credit-card", label: "Cartão" },
  { name: "tag", label: "Tag" },
  { name: "award", label: "Prêmio" },
  { name: "star", label: "Estrela" },
  { name: "heart", label: "Coração" },
  { name: "server", label: "Servidor" },
  { name: "database", label: "Banco" },
  { name: "wifi", label: "Wi-Fi" },
  { name: "monitor", label: "Monitor" },
  { name: "smartphone", label: "Celular" },
  { name: "image", label: "Imagem" },
  { name: "camera", label: "Câmera" },
  { name: "video", label: "Vídeo" },
  { name: "mic", label: "Microfone" },
  { name: "home", label: "Casa" },
  { name: "map", label: "Mapa" },
  { name: "globe", label: "Global" },
  { name: "compass", label: "Bússola" },
  { name: "clock", label: "Relógio" },
  { name: "calendar", label: "Calendário" },
  { name: "sun", label: "Sol" },
  { name: "droplet", label: "Água" },
  { name: "wind", label: "Vento" },
  { name: "flag", label: "Bandeira" },
  { name: "bookmark", label: "Marcador" },
  { name: "gift", label: "Presente" },
  { name: "zap", label: "Raio" },
  { name: "link", label: "Link" },
  { name: "check-circle", label: "Concluído" },
  { name: "edit-3", label: "Assinatura" },
  { name: "pen-tool", label: "Caneta" },
  { name: "settings", label: "Config." },
  { name: "tool", label: "Ferramenta" },
  { name: "truck", label: "Entrega" },
  { name: "layers", label: "Camadas" },
  { name: "grid", label: "Grade" },
  { name: "list", label: "Lista" },
  { name: "hash", label: "Hash" },
  { name: "percent", label: "Porcento" },
  { name: "activity", label: "Atividade" },
  { name: "target", label: "Meta" },
];

const CATEGORIES = [
  { value: "terms", label: "Termos" },
  { value: "conduct", label: "Conduta" },
  { value: "hr", label: "RH" },
  { value: "safety", label: "Segurança" },
  { value: "other", label: "Outros" },
];

const DOC_TYPES = [
  { value: "text", label: "Texto" },
  { value: "pdf", label: "PDF" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function TextRow({
  label, value, onChangeText, placeholder, multiline, editable = true,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; multiline?: boolean; editable?: boolean;
}) {
  return (
    <FieldRow label={label}>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti, !editable && { opacity: 0.5 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        multiline={multiline}
        editable={editable}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </FieldRow>
  );
}

function SwitchRow({
  label, value, onValueChange, desc,
}: {
  label: string; value: boolean; onValueChange: (v: boolean) => void; desc?: string;
}) {
  return (
    <TouchableOpacity style={styles.switchRow} onPress={() => onValueChange(!value)} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {desc && <Text style={styles.switchDesc}>{desc}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: C.tint, false: C.borderLight }} thumbColor="#fff" />
    </TouchableOpacity>
  );
}

function SegmentSelect<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[styles.segmentBtn, value === o.value && styles.segmentBtnActive]}
          onPress={() => onChange(o.value)}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, value === o.value && styles.segmentTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── ColorPicker ──────────────────────────────────────────────────────────────
function ColorPicker({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (c: string) => void;
}) {
  return (
    <FieldRow label={label}>
      <View style={styles.colorGrid}>
        {options.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              value === color && styles.colorSwatchSelected,
            ]}
            onPress={() => onChange(color)}
            activeOpacity={0.8}
          >
            {value === color && <Feather name="check" size={13} color="#fff" />}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.colorCustomRow}>
        <View style={[styles.colorPreview, { backgroundColor: value }]} />
        <TextInput
          style={[styles.input, { flex: 1, paddingVertical: 7 }]}
          value={value}
          onChangeText={onChange}
          placeholder="#000000"
          placeholderTextColor={C.textMuted}
          autoCapitalize="characters"
          maxLength={9}
        />
      </View>
    </FieldRow>
  );
}

// ─── IconPickerModal ──────────────────────────────────────────────────────────
function IconPickerModal({ visible, value, onClose, onChange }: {
  visible: boolean; value: string | null; onClose: () => void; onChange: (icon: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() =>
    search.trim()
      ? ICON_LIST.filter((i) =>
          i.label.toLowerCase().includes(search.toLowerCase()) ||
          (i.name || "").includes(search.toLowerCase())
        )
      : ICON_LIST,
    [search]
  );

  const COLS = 4;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={[styles.modalHeader, { paddingTop: Platform.OS === "ios" ? 54 : 14 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Escolher Ícone</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.searchBar}>
          <Feather name="search" size={15} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar ícone..."
            placeholderTextColor={C.textMuted}
            autoFocus={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={C.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <FlatList
          data={filtered}
          numColumns={COLS}
          keyExtractor={(item) => item.name ?? "__none__"}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const selected = value === item.name;
            return (
              <TouchableOpacity
                style={[styles.iconCell, selected && styles.iconCellSelected]}
                onPress={() => { onChange(item.name); onClose(); }}
                activeOpacity={0.8}
              >
                {item.name ? (
                  <Feather name={item.name as any} size={22} color={selected ? C.tint : C.textSecondary} />
                ) : (
                  <Feather name="slash" size={22} color={selected ? C.tint : C.textMuted} />
                )}
                <Text style={[styles.iconCellLabel, selected && { color: C.tint }]} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ─── IconSelector ─────────────────────────────────────────────────────────────
function IconSelector({ label, value, onChange }: {
  label: string; value: string | null; onChange: (icon: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <FieldRow label={label}>
      <TouchableOpacity
        style={styles.iconSelectorBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.iconSelectorPreview}>
          {value
            ? <Feather name={value as any} size={18} color={C.tint} />
            : <Feather name="slash" size={18} color={C.textMuted} />
          }
        </View>
        <Text style={styles.iconSelectorText}>{value || "Nenhum ícone"}</Text>
        <Feather name="chevron-right" size={16} color={C.textMuted} />
      </TouchableOpacity>
      <IconPickerModal visible={open} value={value} onClose={() => setOpen(false)} onChange={onChange} />
    </FieldRow>
  );
}

// ─── SectionPickerModal ───────────────────────────────────────────────────────
type NewSectionState = { name: string; icon: string | null; color: string; colorBg: string };

function SectionPickerModal({ visible, sections, onClose, onSelect }: {
  visible: boolean;
  sections: SectionDef[];
  onClose: () => void;
  onSelect: (section: { name: string; icon: string | null; color: string; colorBg: string } | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newSec, setNewSec] = useState<NewSectionState>({
    name: "", icon: "shield", color: "#2563EB", colorBg: "#EFF6FF",
  });
  const [iconOpen, setIconOpen] = useState(false);

  function resetCreate() {
    setCreating(false);
    setNewSec({ name: "", icon: "shield", color: "#2563EB", colorBg: "#EFF6FF" });
  }

  function handleCreate() {
    if (!newSec.name.trim()) { Alert.alert("Atenção", "Digite um nome para a seção."); return; }
    onSelect({ name: newSec.name.trim(), icon: newSec.icon, color: newSec.color, colorBg: newSec.colorBg });
    resetCreate();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { resetCreate(); onClose(); }}>
      <View style={styles.modalContainer}>
        <View style={[styles.modalHeader, { paddingTop: Platform.OS === "ios" ? 54 : 14 }]}>
          <TouchableOpacity onPress={() => { if (creating) { resetCreate(); } else { onClose(); } }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name={creating ? "arrow-left" : "x"} size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{creating ? "Nova Seção" : "Escolher Seção"}</Text>
          {creating
            ? <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}><Text style={styles.saveBtnText}>Usar</Text></TouchableOpacity>
            : <View style={{ width: 60 }} />
          }
        </View>

        {creating ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }} keyboardShouldPersistTaps="handled">
            <TextRow
              label="Nome da seção *"
              value={newSec.name}
              onChangeText={(t) => setNewSec((p) => ({ ...p, name: t }))}
              placeholder="Ex: Código de Conduta"
            />
            <IconSelector
              label="Ícone da seção"
              value={newSec.icon}
              onChange={(icon) => setNewSec((p) => ({ ...p, icon }))}
            />
            <ColorPicker
              label="Cor principal"
              value={newSec.color}
              options={SECTION_COLORS}
              onChange={(color) => setNewSec((p) => ({ ...p, color }))}
            />
            <ColorPicker
              label="Cor de fundo"
              value={newSec.colorBg}
              options={BG_COLORS}
              onChange={(colorBg) => setNewSec((p) => ({ ...p, colorBg }))}
            />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
            <TouchableOpacity
              style={styles.secPickerCreate}
              onPress={() => setCreating(true)}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={16} color={C.tint} />
              <Text style={styles.secPickerCreateText}>Nova seção</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secPickerNone}
              onPress={() => { onSelect(null); onClose(); }}
              activeOpacity={0.8}
            >
              <Feather name="slash" size={16} color={C.textMuted} />
              <Text style={styles.secPickerNoneText}>Sem seção</Text>
            </TouchableOpacity>
            {sections.map((sec) => (
              <TouchableOpacity
                key={sec.sectionName}
                style={styles.secPickerItem}
                onPress={() => {
                  onSelect({
                    name: sec.sectionName,
                    icon: sec.sectionIcon,
                    color: sec.sectionColor || "#2563EB",
                    colorBg: sec.sectionColorBg || "#EFF6FF",
                  });
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.secPickerIcon, { backgroundColor: sec.sectionColorBg || "#EFF6FF" }]}>
                  {sec.sectionIcon
                    ? <Feather name={sec.sectionIcon as any} size={16} color={sec.sectionColor || C.tint} />
                    : <Feather name="folder" size={16} color={C.textMuted} />
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.secPickerName}>{sec.sectionName}</Text>
                  <Text style={styles.secPickerCount}>{sec.count} doc{sec.count !== 1 ? "s" : ""}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={C.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── FlagPill ────────────────────────────────────────────────────────────────
function FlagPill({ icon, label, active }: { icon: any; label: string; active: boolean }) {
  return (
    <View style={[styles.flagPill, active ? styles.flagPillActive : styles.flagPillOff]}>
      <Feather name={icon} size={9} color={active ? C.tint : C.textMuted} />
      <Text style={[styles.flagText, active ? styles.flagTextActive : styles.flagTextOff]}>{label}</Text>
    </View>
  );
}

// ─── DocCard ─────────────────────────────────────────────────────────────────
function DocCard({ item, onEdit, onToggleActive, onDelete }: {
  item: IntegraItem; onEdit: () => void; onToggleActive: () => void; onDelete: () => void;
}) {
  const secColor = item.sectionColor || C.tint;
  const secBg = item.sectionColorBg || "#EFF6FF";
  return (
    <View style={[styles.docCard, !item.isActive && styles.docCardInactive]}>
      <View style={styles.docCardTop}>
        <View style={[styles.docCardIcon, { backgroundColor: secBg }]}>
          {item.iconName
            ? <Feather name={item.iconName as any} size={16} color={secColor} />
            : <Feather name="file-text" size={16} color={secColor} />
          }
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.docCardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.docCardSection}>{item.sectionName || item.category}</Text>
        </View>
        <View style={styles.docCardBadges}>
          {!item.isActive && (
            <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inativo</Text></View>
          )}
          {item.requiresSign && (
            <View style={styles.signBadge}>
              <Feather name="edit-3" size={9} color="#7C3AED" />
              <Text style={styles.signBadgeText}>Assin.</Text>
            </View>
          )}
          {item.docType === "pdf" && (
            <View style={styles.pdfBadge}>
              <Feather name="file" size={9} color="#DC2626" />
              <Text style={styles.pdfBadgeText}>PDF</Text>
            </View>
          )}
        </View>
      </View>
      {item.subtitle ? <Text style={styles.docCardSubtitle} numberOfLines={2}>{item.subtitle}</Text> : null}
      <View style={styles.docCardFlags}>
        <FlagPill icon="monitor" label="Integra" active={item.showInIntegra} />
        <FlagPill icon="log-in" label="Onboarding" active={item.showInOnboarding} />
        <FlagPill icon="bar-chart-2" label="Progresso" active={item.countsForProgress} />
      </View>
      <View style={styles.docCardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.8}>
          <Feather name="edit-2" size={14} color={C.tint} />
          <Text style={styles.actionBtnText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onToggleActive} activeOpacity={0.8}>
          <Feather name={item.isActive ? "eye-off" : "eye"} size={14} color={C.textSecondary} />
          <Text style={[styles.actionBtnText, { color: C.textSecondary }]}>{item.isActive ? "Desativar" : "Ativar"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onDelete} activeOpacity={0.8}>
          <Feather name="trash-2" size={14} color="#EF4444" />
          <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── DocFormModal ─────────────────────────────────────────────────────────────
function DocFormModal({ visible, item, sections, onClose, onSaved }: {
  visible: boolean;
  item: IntegraItem | null;
  sections: SectionDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [form, setForm] = useState<FormState>(item ? itemToForm(item) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [secPickerOpen, setSecPickerOpen] = useState(false);

  React.useEffect(() => {
    if (visible) setForm(item ? itemToForm(item) : EMPTY_FORM);
  }, [visible, item]);

  function set(key: keyof FormState, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function pickPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadingPdf(true);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const data = await api.post("/integra-items/upload-pdf", { base64, filename: asset.name });
      set("pdfUrl", data.url);
    } catch {
      Alert.alert("Erro", "Não foi possível fazer o upload do PDF.");
    } finally {
      setUploadingPdf(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { Alert.alert("Atenção", "O título é obrigatório."); return; }
    if (!form.category.trim()) { Alert.alert("Atenção", "A categoria é obrigatória."); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        category: form.category.trim(),
        sectionName: form.sectionName.trim() || null,
        sectionIcon: form.sectionIcon || null,
        sectionColor: form.sectionName.trim() ? (form.sectionColor || null) : null,
        sectionColorBg: form.sectionName.trim() ? (form.sectionColorBg || null) : null,
        iconName: form.iconName || null,
        docType: form.docType,
        content: form.docType === "text" ? (form.content.trim() || null) : null,
        pdfUrl: form.docType === "pdf" ? (form.pdfUrl.trim() || null) : null,
        requiresSign: form.requiresSign,
        requiresRead: form.requiresRead,
        countsForProgress: form.countsForProgress,
        showInIntegra: form.showInIntegra,
        showInOnboarding: form.showInOnboarding,
        sortOrder: parseInt(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (isEdit && item) {
        await api.patch(`/integra-items/${item.id}`, payload);
      } else {
        await api.post("/integra-items", payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{isEdit ? "Editar Documento" : "Novo Documento"}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Identificação ── */}
            <Text style={styles.sectionLabel}>Identificação</Text>
            <TextRow label="Título *" value={form.title} onChangeText={(t) => set("title", t)} placeholder="Ex: Código de Conduta" />
            <TextRow label="Subtítulo" value={form.subtitle} onChangeText={(t) => set("subtitle", t)} placeholder="Breve descrição" />

            {/* ── Categoria ── */}
            <Text style={styles.sectionLabel}>Categoria e Seção</Text>
            <FieldRow label="Categoria *">
              <SegmentSelect value={form.category as any} options={CATEGORIES as any} onChange={(v) => set("category", v)} />
            </FieldRow>

            {/* Section picker */}
            <FieldRow label="Seção">
              <TouchableOpacity
                style={styles.secSelectorBtn}
                onPress={() => setSecPickerOpen(true)}
                activeOpacity={0.8}
              >
                {form.sectionName ? (
                  <View style={[styles.secSelectorIcon, { backgroundColor: form.sectionColorBg || "#EFF6FF" }]}>
                    {form.sectionIcon
                      ? <Feather name={form.sectionIcon as any} size={14} color={form.sectionColor || C.tint} />
                      : <Feather name="folder" size={14} color={C.textMuted} />
                    }
                  </View>
                ) : null}
                <Text style={[styles.secSelectorText, !form.sectionName && { color: C.textMuted }]}>
                  {form.sectionName || "Sem seção (selecionar ou criar)"}
                </Text>
                <Feather name="chevron-down" size={16} color={C.textMuted} />
              </TouchableOpacity>
            </FieldRow>

            {/* Section colors/icons - only when section is set */}
            {form.sectionName ? (
              <>
                <IconSelector label="Ícone da seção" value={form.sectionIcon} onChange={(v) => set("sectionIcon", v)} />
                <ColorPicker label="Cor da seção" value={form.sectionColor} options={SECTION_COLORS} onChange={(v) => set("sectionColor", v)} />
                <ColorPicker label="Cor de fundo da seção" value={form.sectionColorBg} options={BG_COLORS} onChange={(v) => set("sectionColorBg", v)} />
              </>
            ) : null}

            {/* Item icon */}
            <IconSelector label="Ícone do item" value={form.iconName} onChange={(v) => set("iconName", v)} />
            <TextRow label="Ordem" value={form.sortOrder} onChangeText={(t) => set("sortOrder", t)} placeholder="0" />

            {/* ── Conteúdo ── */}
            <Text style={styles.sectionLabel}>Conteúdo</Text>
            <FieldRow label="Tipo">
              <SegmentSelect value={form.docType as any} options={DOC_TYPES as any} onChange={(v) => set("docType", v)} />
            </FieldRow>

            {form.docType === "text" && (
              <TextRow label="Texto" value={form.content} onChangeText={(t) => set("content", t)} placeholder="Conteúdo do documento..." multiline />
            )}

            {form.docType === "pdf" && (
              <FieldRow label="Arquivo PDF">
                <View style={{ gap: 8 }}>
                  {form.pdfUrl ? (
                    <View style={styles.pdfPreview}>
                      <Feather name="file" size={14} color="#DC2626" />
                      <Text style={styles.pdfPreviewText} numberOfLines={1}>{form.pdfUrl.split("/").pop()}</Text>
                      <TouchableOpacity onPress={() => set("pdfUrl", "")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="x" size={14} color={C.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.uploadPdfBtn, uploadingPdf && { opacity: 0.5 }]}
                    onPress={pickPdf}
                    disabled={uploadingPdf}
                    activeOpacity={0.8}
                  >
                    {uploadingPdf ? <ActivityIndicator size="small" color={C.tint} /> : <Feather name="upload" size={14} color={C.tint} />}
                    <Text style={styles.uploadPdfText}>{uploadingPdf ? "Enviando..." : form.pdfUrl ? "Substituir PDF" : "Selecionar PDF"}</Text>
                  </TouchableOpacity>
                </View>
              </FieldRow>
            )}

            {/* ── Comportamento ── */}
            <Text style={styles.sectionLabel}>Comportamento</Text>
            <SwitchRow label="Exibir no Integra" value={form.showInIntegra} onValueChange={(v) => set("showInIntegra", v)} desc="Aparece na aba Integra do app" />
            <SwitchRow label="Exibir no Onboarding" value={form.showInOnboarding} onValueChange={(v) => set("showInOnboarding", v)} desc="Aparece no primeiro acesso" />
            <SwitchRow label="Conta para Progresso" value={form.countsForProgress} onValueChange={(v) => set("countsForProgress", v)} desc="Incluído no percentual de leitura" />
            <SwitchRow label="Requer Leitura" value={form.requiresRead} onValueChange={(v) => set("requiresRead", v)} desc="Mostra checkbox 'Marcar como lido'" />
            <SwitchRow label="Requer Assinatura" value={form.requiresSign} onValueChange={(v) => set("requiresSign", v)} desc="Exibe fluxo de assinatura formal" />
            <SwitchRow label="Ativo" value={form.isActive} onValueChange={(v) => set("isActive", v)} desc="Documentos inativos ficam ocultos" />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <SectionPickerModal
        visible={secPickerOpen}
        sections={sections}
        onClose={() => setSecPickerOpen(false)}
        onSelect={(sec) => {
          if (sec) {
            set("sectionName", sec.name);
            set("sectionIcon", sec.icon);
            set("sectionColor", sec.color);
            set("sectionColorBg", sec.colorBg);
          } else {
            set("sectionName", "");
            set("sectionIcon", null);
          }
        }}
      />
    </Modal>
  );
}

// ─── SectionsView ─────────────────────────────────────────────────────────────
function SectionsView({ sections, isLoading, onCreateNew, onDelete }: {
  sections: SectionDef[];
  isLoading: boolean;
  onCreateNew: () => void;
  onDelete: (name: string) => void;
}) {
  if (isLoading) return <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
      <TouchableOpacity style={styles.createSectionBtn} onPress={onCreateNew} activeOpacity={0.8}>
        <Feather name="plus-circle" size={16} color={C.tint} />
        <Text style={styles.createSectionBtnText}>Nova Seção</Text>
      </TouchableOpacity>

      {sections.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="layers" size={36} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Nenhuma seção cadastrada</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" }}>
            Crie seções ao adicionar documentos, ou use o botão acima.
          </Text>
        </View>
      )}

      {sections.map((sec) => {
        const color = sec.sectionColor || C.tint;
        const bg = sec.sectionColorBg || "#EFF6FF";
        return (
          <View key={sec.sectionName} style={styles.sectionCard}>
            <View style={[styles.sectionCardAccent, { backgroundColor: color }]} />
            <View style={[styles.sectionCardIcon, { backgroundColor: bg }]}>
              {sec.sectionIcon
                ? <Feather name={sec.sectionIcon as any} size={18} color={color} />
                : <Feather name="folder" size={18} color={C.textMuted} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCardName}>{sec.sectionName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <View style={[styles.sectionColorDot, { backgroundColor: color }]} />
                <View style={[styles.sectionColorDot, { backgroundColor: bg, borderWidth: 1, borderColor: C.border }]} />
                <Text style={styles.sectionCardCount}>{sec.count} documento{sec.count !== 1 ? "s" : ""}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.sectionDeleteBtn}
              onPress={() => onDelete(sec.sectionName)}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={15} color="#EF4444" />
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function AdminDocsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 118 : insets.bottom + 20;

  const [view, setView] = useState<"docs" | "sections">("docs");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<IntegraItem | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery<IntegraItem[]>({
    queryKey: ["admin-integra-items"],
    queryFn: () => api.get("/integra-items/admin"),
  });

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<SectionDef[]>({
    queryKey: ["admin-sections"],
    queryFn: () => api.get("/integra-items/sections"),
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["admin-integra-items"] });
    qc.invalidateQueries({ queryKey: ["admin-sections"] });
    qc.invalidateQueries({ queryKey: ["integra-items"] });
    qc.invalidateQueries({ queryKey: ["integra-items-onboarding"] });
  }

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patch(`/integra-items/${id}`, { isActive: !isActive }),
    onSuccess: invalidateAll,
    onError: () => Alert.alert("Erro", "Não foi possível atualizar o item."),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/integra-items/${id}`),
    onSuccess: invalidateAll,
    onError: () => Alert.alert("Erro", "Não foi possível excluir o item."),
  });

  const deleteSection = useMutation({
    mutationFn: (name: string) => api.delete(`/integra-items/sections/${encodeURIComponent(name)}`),
    onSuccess: invalidateAll,
    onError: () => Alert.alert("Erro", "Não foi possível excluir a seção."),
  });

  function handleDelete(item: IntegraItem) {
    Alert.alert(
      "Excluir documento",
      `Excluir "${item.title}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => deleteItem.mutate(item.id) },
      ]
    );
  }

  function handleDeleteSection(name: string) {
    Alert.alert(
      "Excluir seção",
      `Remover a seção "${name}" de todos os documentos? Os documentos continuarão existindo, mas sem seção.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: () => deleteSection.mutate(name) },
      ]
    );
  }

  async function handleSeed() {
    Alert.alert(
      "Inicializar Conteúdo",
      "Isso irá criar os documentos padrão do Grupo Beija-flor. Só funciona se a lista estiver vazia.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Inicializar", onPress: async () => {
            try {
              const result = await api.post("/integra-items/seed", {});
              Alert.alert("Sucesso", result.message);
              invalidateAll();
            } catch (e: any) {
              Alert.alert("Erro", e.message);
            }
          },
        },
      ]
    );
  }

  const filtered = items.filter((item) => {
    if (filter === "active" && !item.isActive) return false;
    if (filter === "inactive" && item.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q) || (item.sectionName || "").toLowerCase().includes(q) || item.docKey.includes(q);
    }
    return true;
  });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Central de Documentos</Text>
        {view === "docs" ? (
          <TouchableOpacity onPress={() => { setEditItem(null); setShowModal(true); }} style={styles.addBtn} activeOpacity={0.8}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 34 }} />
        )}
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{items.filter((i) => i.isActive).length}</Text>
          <Text style={styles.statLabel}>Ativos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{sections.length}</Text>
          <Text style={styles.statLabel}>Seções</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={handleSeed} activeOpacity={0.8}>
          <Feather name="database" size={14} color={C.tint} />
          <Text style={[styles.statLabel, { color: C.tint }]}>Seed</Text>
        </TouchableOpacity>
      </View>

      {/* View toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity style={[styles.viewTab, view === "docs" && styles.viewTabActive]} onPress={() => setView("docs")} activeOpacity={0.8}>
          <Feather name="file-text" size={13} color={view === "docs" ? C.tint : C.textMuted} />
          <Text style={[styles.viewTabText, view === "docs" && styles.viewTabTextActive]}>Documentos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewTab, view === "sections" && styles.viewTabActive]} onPress={() => setView("sections")} activeOpacity={0.8}>
          <Feather name="layers" size={13} color={view === "sections" ? C.tint : C.textMuted} />
          <Text style={[styles.viewTabText, view === "sections" && styles.viewTabTextActive]}>Seções</Text>
        </TouchableOpacity>
      </View>

      {view === "docs" ? (
        <>
          {/* Search */}
          <View style={styles.searchBar}>
            <Feather name="search" size={15} color={C.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por título ou seção..."
              placeholderTextColor={C.textMuted}
            />
            {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={15} color={C.textMuted} /></TouchableOpacity> : null}
          </View>
          <View style={styles.filterRow}>
            {(["all", "active", "inactive"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, filter === f && styles.filterTabActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                  {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Inativos"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {isLoading ? (
            <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="file-text" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>
                {items.length === 0 ? "Nenhum documento cadastrado" : "Nenhum resultado"}
              </Text>
              {items.length === 0 && (
                <TouchableOpacity style={styles.seedBtn} onPress={handleSeed} activeOpacity={0.8}>
                  <Feather name="database" size={14} color="#fff" />
                  <Text style={styles.seedBtnText}>Inicializar com conteúdo padrão</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView contentContainerStyle={[styles.list, { paddingBottom: botPad }]} showsVerticalScrollIndicator={false}>
              {filtered.map((item) => (
                <DocCard
                  key={item.id}
                  item={item}
                  onEdit={() => { setEditItem(item); setShowModal(true); }}
                  onToggleActive={() => toggleActive.mutate({ id: item.id, isActive: item.isActive })}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <SectionsView
          sections={sections}
          isLoading={sectionsLoading}
          onCreateNew={() => { setEditItem(null); setShowModal(true); setView("docs"); }}
          onDelete={handleDeleteSection}
        />
      )}

      <DocFormModal
        visible={showModal}
        item={editItem}
        sections={sections}
        onClose={() => setShowModal(false)}
        onSaved={invalidateAll}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text, flex: 1, textAlign: "center" },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },

  statsBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: C.textMuted },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  viewToggle: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 12,
  },
  viewTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  viewTabActive: { borderBottomColor: C.tint },
  viewTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textMuted },
  viewTabTextActive: { color: C.tint, fontFamily: "Inter_600SemiBold" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },

  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  filterTabActive: { backgroundColor: C.tint, borderColor: C.tint },
  filterTabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  filterTabTextActive: { color: "#fff" },

  list: { padding: 12, gap: 10 },

  docCard: {
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  docCardInactive: { opacity: 0.6 },
  docCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, paddingBottom: 6 },
  docCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  docCardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, lineHeight: 19 },
  docCardSection: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  docCardBadges: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  inactiveBadge: { backgroundColor: "#FEF2F2", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: "#FECACA" },
  inactiveBadgeText: { fontSize: 9, color: "#DC2626", fontFamily: "Inter_600SemiBold" },
  signBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F5F3FF", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  signBadgeText: { fontSize: 9, color: "#7C3AED", fontFamily: "Inter_600SemiBold" },
  pdfBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FEF2F2", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  pdfBadgeText: { fontSize: 9, color: "#DC2626", fontFamily: "Inter_600SemiBold" },
  docCardSubtitle: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginHorizontal: 12, marginBottom: 8, lineHeight: 17 },
  docCardFlags: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  flagPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  flagPillActive: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  flagPillOff: { backgroundColor: C.surfaceAlt, borderColor: C.border },
  flagText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  flagTextActive: { color: C.tint },
  flagTextOff: { color: C.textMuted },
  docCardActions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10 },
  actionBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.tint },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textAlign: "center" },
  seedBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.tint, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  seedBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // ── Section cards ──
  sectionCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, overflow: "hidden",
  },
  sectionCardAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  sectionCardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionCardName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  sectionCardCount: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  sectionColorDot: { width: 12, height: 12, borderRadius: 6 },
  sectionDeleteBtn: { padding: 4 },
  createSectionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: C.tint, borderStyle: "dashed", borderRadius: 12,
    paddingVertical: 12, backgroundColor: "#EFF6FF",
  },
  createSectionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.tint },

  // ── Modal ──
  modalContainer: { flex: 1, backgroundColor: C.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingTop: Platform.OS === "ios" ? 54 : 14,
  },
  modalTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  saveBtn: { backgroundColor: C.tint, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, minWidth: 64, alignItems: "center" },
  saveBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalContent: { padding: 16, gap: 4, paddingBottom: 60 },

  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 16, marginBottom: 4 },
  fieldRow: { gap: 4, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  input: {
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.text, fontFamily: "Inter_400Regular",
  },
  inputMulti: { height: 140, textAlignVertical: "top", paddingTop: 10 },

  segmentRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  segmentBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  segmentText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  segmentTextActive: { color: "#fff" },

  switchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  switchLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  switchDesc: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },

  // ── Color picker ──
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  colorSwatchSelected: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4, transform: [{ scale: 1.15 }] },
  colorCustomRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  colorPreview: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: C.border },

  // ── Icon picker ──
  iconCell: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 4,
    padding: 12, margin: 4, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface,
  },
  iconCellSelected: { borderColor: C.tint, backgroundColor: "#EFF6FF" },
  iconCellLabel: { fontSize: 9, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },

  // ── Icon selector ──
  iconSelectorBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  iconSelectorPreview: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center",
  },
  iconSelectorText: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },

  // ── Section picker ──
  secSelectorBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  secSelectorIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  secSelectorText: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },

  secPickerCreate: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 12, borderWidth: 1.5, borderColor: C.tint,
    borderStyle: "dashed", paddingHorizontal: 14, paddingVertical: 12,
  },
  secPickerCreateText: { fontSize: 14, color: C.tint, fontFamily: "Inter_600SemiBold" },
  secPickerNone: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  secPickerNoneText: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular" },
  secPickerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  secPickerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  secPickerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  secPickerCount: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },

  // ── PDF ──
  pdfPreview: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: "#FECACA",
  },
  pdfPreviewText: { flex: 1, fontSize: 12, color: "#DC2626", fontFamily: "Inter_400Regular" },
  uploadPdfBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: C.tint, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#EFF6FF",
  },
  uploadPdfText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },
});
