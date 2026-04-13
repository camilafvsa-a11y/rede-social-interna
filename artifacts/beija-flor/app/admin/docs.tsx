import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Switch, Platform, KeyboardAvoidingView,
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

type FormState = {
  title: string;
  subtitle: string;
  docKey: string;
  category: string;
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  sectionColorBg: string;
  iconName: string;
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
  title: "", subtitle: "", docKey: "", category: "conduct",
  sectionName: "", sectionIcon: "file-text", sectionColor: "#2563EB", sectionColorBg: "#EFF6FF",
  iconName: "file-text", docType: "text", content: "", pdfUrl: "",
  requiresSign: false, requiresRead: true, countsForProgress: true,
  showInIntegra: true, showInOnboarding: true,
  sortOrder: "0", isActive: true,
};

function itemToForm(item: IntegraItem): FormState {
  return {
    title: item.title,
    subtitle: item.subtitle || "",
    docKey: item.docKey,
    category: item.category,
    sectionName: item.sectionName || "",
    sectionIcon: item.sectionIcon || "file-text",
    sectionColor: item.sectionColor || "#2563EB",
    sectionColorBg: item.sectionColorBg || "#EFF6FF",
    iconName: item.iconName || "file-text",
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

// ─── Field Row ────────────────────────────────────────────────────────────────
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
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: C.tint, false: C.borderLight }}
        thumbColor="#fff"
      />
    </TouchableOpacity>
  );
}

// ─── Category Select ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "terms", label: "Termos" },
  { value: "conduct", label: "Conduta/Políticas" },
  { value: "hr", label: "RH" },
  { value: "safety", label: "Segurança" },
  { value: "other", label: "Outros" },
];

const DOC_TYPES = [
  { value: "text", label: "Texto" },
  { value: "pdf", label: "PDF" },
];

function SegmentSelect<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
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
          <Text style={[styles.segmentText, value === o.value && styles.segmentTextActive]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────
function DocCard({
  item, onEdit, onToggleActive, onDelete,
}: {
  item: IntegraItem;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const secColor = item.sectionColor || C.tint;
  const secBg = item.sectionColorBg || "#EFF6FF";

  return (
    <View style={[styles.docCard, !item.isActive && styles.docCardInactive]}>
      <View style={styles.docCardTop}>
        <View style={[styles.docCardIcon, { backgroundColor: secBg }]}>
          <Feather name={(item.iconName as any) || "file-text"} size={16} color={secColor} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.docCardTitle} numberOfLines={2}>{item.title}</Text>
          {item.sectionName ? (
            <Text style={styles.docCardSection}>{item.sectionName}</Text>
          ) : (
            <Text style={styles.docCardSection}>{item.category}</Text>
          )}
        </View>
        <View style={styles.docCardBadges}>
          {!item.isActive && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inativo</Text>
            </View>
          )}
          {item.requiresSign && (
            <View style={styles.signBadge}>
              <Feather name="edit-3" size={9} color="#7C3AED" />
              <Text style={styles.signBadgeText}>Assinatura</Text>
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
      {item.subtitle ? (
        <Text style={styles.docCardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
      ) : null}

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
          <Text style={[styles.actionBtnText, { color: C.textSecondary }]}>
            {item.isActive ? "Desativar" : "Ativar"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onDelete} activeOpacity={0.8}>
          <Feather name="trash-2" size={14} color="#EF4444" />
          <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FlagPill({ icon, label, active }: { icon: any; label: string; active: boolean }) {
  return (
    <View style={[styles.flagPill, active ? styles.flagPillActive : styles.flagPillOff]}>
      <Feather name={icon} size={9} color={active ? C.tint : C.textMuted} />
      <Text style={[styles.flagText, active ? styles.flagTextActive : styles.flagTextOff]}>{label}</Text>
    </View>
  );
}

// ─── Edit / Create Modal ──────────────────────────────────────────────────────
function DocFormModal({
  visible, item, onClose, onSaved,
}: {
  visible: boolean;
  item: IntegraItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [form, setForm] = useState<FormState>(item ? itemToForm(item) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  React.useEffect(() => {
    if (visible) setForm(item ? itemToForm(item) : EMPTY_FORM);
  }, [visible, item]);

  function set(key: keyof FormState, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function pickPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadingPdf(true);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const data = await api.post("/integra-items/upload-pdf", { base64, filename: asset.name });
      set("pdfUrl", data.url);
    } catch (e: any) {
      Alert.alert("Erro", "Não foi possível fazer o upload do PDF.");
    } finally {
      setUploadingPdf(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { Alert.alert("Atenção", "O título é obrigatório."); return; }
    if (!form.docKey.trim()) { Alert.alert("Atenção", "O docKey é obrigatório."); return; }
    if (!form.category.trim()) { Alert.alert("Atenção", "A categoria é obrigatória."); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        docKey: form.docKey.trim(),
        category: form.category.trim(),
        sectionName: form.sectionName.trim() || null,
        sectionIcon: form.sectionIcon.trim() || null,
        sectionColor: form.sectionColor.trim() || null,
        sectionColorBg: form.sectionColorBg.trim() || null,
        iconName: form.iconName.trim() || "file-text",
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{isEdit ? "Editar Documento" : "Novo Documento"}</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Salvar</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Identificação ── */}
            <Text style={styles.sectionLabel}>Identificação</Text>

            <TextRow label="Título *" value={form.title} onChangeText={(t) => set("title", t)} placeholder="Ex: Código de Conduta" />
            <TextRow label="Subtítulo" value={form.subtitle} onChangeText={(t) => set("subtitle", t)} placeholder="Breve descrição do documento" />
            <TextRow
              label="docKey *"
              value={form.docKey}
              onChangeText={(t) => set("docKey", t.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="Ex: codigo_conduta"
              editable={!isEdit}
            />
            {isEdit && (
              <Text style={styles.fieldHint}>O docKey não pode ser alterado após criação.</Text>
            )}

            {/* ── Categoria ── */}
            <Text style={styles.sectionLabel}>Categoria e Seção</Text>
            <FieldRow label="Categoria *">
              <SegmentSelect
                value={form.category as any}
                options={CATEGORIES as any}
                onChange={(v) => set("category", v)}
              />
            </FieldRow>
            <TextRow label="Nome da Seção" value={form.sectionName} onChangeText={(t) => set("sectionName", t)} placeholder="Ex: Código de Conduta" />
            <TextRow label="Ícone da Seção" value={form.sectionIcon} onChangeText={(t) => set("sectionIcon", t)} placeholder="Ex: shield" />
            <TextRow label="Cor da Seção (hex)" value={form.sectionColor} onChangeText={(t) => set("sectionColor", t)} placeholder="#2563EB" />
            <TextRow label="Cor de Fundo (hex)" value={form.sectionColorBg} onChangeText={(t) => set("sectionColorBg", t)} placeholder="#EFF6FF" />
            <TextRow label="Ícone do Item" value={form.iconName} onChangeText={(t) => set("iconName", t)} placeholder="Ex: file-text" />
            <TextRow label="Ordem" value={form.sortOrder} onChangeText={(t) => set("sortOrder", t)} placeholder="0" />

            {/* ── Conteúdo ── */}
            <Text style={styles.sectionLabel}>Conteúdo</Text>
            <FieldRow label="Tipo">
              <SegmentSelect
                value={form.docType as any}
                options={DOC_TYPES as any}
                onChange={(v) => set("docType", v)}
              />
            </FieldRow>

            {form.docType === "text" && (
              <TextRow
                label="Texto"
                value={form.content}
                onChangeText={(t) => set("content", t)}
                placeholder="Conteúdo completo do documento..."
                multiline
              />
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
                    {uploadingPdf
                      ? <ActivityIndicator size="small" color={C.tint} />
                      : <Feather name="upload" size={14} color={C.tint} />
                    }
                    <Text style={styles.uploadPdfText}>
                      {uploadingPdf ? "Enviando..." : form.pdfUrl ? "Substituir PDF" : "Selecionar PDF"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </FieldRow>
            )}

            {/* ── Comportamento ── */}
            <Text style={styles.sectionLabel}>Comportamento</Text>
            <SwitchRow
              label="Exibir no Integra"
              value={form.showInIntegra}
              onValueChange={(v) => set("showInIntegra", v)}
              desc="Aparece na aba Integra do app"
            />
            <SwitchRow
              label="Exibir no Onboarding"
              value={form.showInOnboarding}
              onValueChange={(v) => set("showInOnboarding", v)}
              desc="Aparece no primeiro acesso do colaborador"
            />
            <SwitchRow
              label="Conta para Progresso"
              value={form.countsForProgress}
              onValueChange={(v) => set("countsForProgress", v)}
              desc="Incluído no percentual de leitura"
            />
            <SwitchRow
              label="Requer Leitura"
              value={form.requiresRead}
              onValueChange={(v) => set("requiresRead", v)}
              desc="Mostra checkbox 'Marcar como lido'"
            />
            <SwitchRow
              label="Requer Assinatura"
              value={form.requiresSign}
              onValueChange={(v) => set("requiresSign", v)}
              desc="Exibe fluxo de assinatura formal"
            />
            <SwitchRow
              label="Ativo"
              value={form.isActive}
              onValueChange={(v) => set("isActive", v)}
              desc="Documentos inativos ficam ocultos"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function AdminDocsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 118 : insets.bottom + 20;

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<IntegraItem | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading, refetch } = useQuery<IntegraItem[]>({
    queryKey: ["admin-integra-items"],
    queryFn: () => api.get("/integra-items/admin"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patch(`/integra-items/${id}`, { isActive: !isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-integra-items"] });
      qc.invalidateQueries({ queryKey: ["integra-items"] });
    },
    onError: () => Alert.alert("Erro", "Não foi possível atualizar o item."),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/integra-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-integra-items"] });
      qc.invalidateQueries({ queryKey: ["integra-items"] });
    },
    onError: () => Alert.alert("Erro", "Não foi possível excluir o item."),
  });

  function handleDelete(item: IntegraItem) {
    Alert.alert(
      "Excluir documento",
      `Tem certeza que deseja excluir "${item.title}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir", style: "destructive",
          onPress: () => deleteItem.mutate(item.id),
        },
      ]
    );
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ["admin-integra-items"] });
    qc.invalidateQueries({ queryKey: ["integra-items"] });
    qc.invalidateQueries({ queryKey: ["integra-items-onboarding"] });
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
              handleSaved();
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
      return item.title.toLowerCase().includes(q) || item.docKey.toLowerCase().includes(q) || (item.sectionName || "").toLowerCase().includes(q);
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
        <TouchableOpacity
          onPress={() => { setEditItem(null); setShowModal(true); }}
          style={styles.addBtn}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
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
          <Text style={styles.statValue}>{items.filter((i) => i.requiresSign).length}</Text>
          <Text style={styles.statLabel}>Com Assinatura</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={handleSeed} activeOpacity={0.8}>
          <Feather name="database" size={14} color={C.tint} />
          <Text style={[styles.statLabel, { color: C.tint }]}>Seed</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Feather name="search" size={15} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por título, seção ou docKey..."
          placeholderTextColor={C.textMuted}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={C.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter tabs */}
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

      {/* List */}
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
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: botPad }]}
          showsVerticalScrollIndicator={false}
        >
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

      {/* Form Modal */}
      <DocFormModal
        visible={showModal}
        item={editItem}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text, flex: 1, textAlign: "center" },
  addBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },

  statsBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: C.textMuted },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: C.surface, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },

  filterRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 12, paddingBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface,
  },
  filterTabActive: { backgroundColor: C.tint, borderColor: C.tint },
  filterTabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  filterTabTextActive: { color: "#fff" },

  list: { padding: 12, gap: 10 },

  docCard: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  docCardInactive: { opacity: 0.6 },
  docCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, paddingBottom: 6 },
  docCardIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  docCardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, lineHeight: 19 },
  docCardSection: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  docCardBadges: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  inactiveBadge: {
    backgroundColor: "#FEF2F2", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: "#FECACA",
  },
  inactiveBadgeText: { fontSize: 9, color: "#DC2626", fontFamily: "Inter_600SemiBold" },
  signBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#F5F3FF", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  signBadgeText: { fontSize: 9, color: "#7C3AED", fontFamily: "Inter_600SemiBold" },
  pdfBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FEF2F2", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  pdfBadgeText: { fontSize: 9, color: "#DC2626", fontFamily: "Inter_600SemiBold" },
  docCardSubtitle: {
    fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular",
    marginHorizontal: 12, marginBottom: 8, lineHeight: 17,
  },
  docCardFlags: {
    flexDirection: "row", gap: 6,
    paddingHorizontal: 12, paddingBottom: 8,
  },
  flagPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1,
  },
  flagPillActive: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  flagPillOff: { backgroundColor: C.surfaceAlt, borderColor: C.border },
  flagText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  flagTextActive: { color: C.tint },
  flagTextOff: { color: C.textMuted },
  docCardActions: {
    flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10,
  },
  actionBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.tint },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textAlign: "center" },
  seedBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  seedBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // ── Modal ──
  modalContainer: { flex: 1, backgroundColor: C.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingTop: Platform.OS === "ios" ? 54 : 14,
  },
  modalTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  saveBtn: {
    backgroundColor: C.tint, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
    minWidth: 64, alignItems: "center",
  },
  saveBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalContent: { padding: 16, gap: 4, paddingBottom: 60 },

  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: C.textMuted,
    textTransform: "uppercase", letterSpacing: 0.8,
    marginTop: 16, marginBottom: 4,
  },
  fieldRow: { gap: 4, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  fieldHint: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 4 },
  input: {
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.text, fontFamily: "Inter_400Regular",
  },
  inputMulti: { height: 140, textAlignVertical: "top", paddingTop: 10 },

  segmentRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  segmentBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface,
  },
  segmentBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  segmentText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  segmentTextActive: { color: "#fff" },

  switchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  switchLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  switchDesc: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },

  pdfPreview: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: "#FECACA",
  },
  pdfPreviewText: { flex: 1, fontSize: 12, color: "#DC2626", fontFamily: "Inter_400Regular" },
  uploadPdfBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: C.tint, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: "#EFF6FF",
  },
  uploadPdfText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },
});
