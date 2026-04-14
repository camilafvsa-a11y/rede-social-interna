import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image, Platform, Modal, TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { RichText } from "@/components/RichText";

const C = Colors.light;

// ─── Etapas ──────────────────────────────────────────────────────────────────
const STEPS = [
  { id: "photo",         title: "Foto de Perfil",         description: "Adicione uma foto para seus colegas te reconhecerem" },
  { id: "personal_data", title: "Dados Pessoais",          description: "Preencha suas informações pessoais. Esses dados são obrigatórios." },
  { id: "values",        title: "Valores da Empresa",      description: "Conheça e confirme os valores que guiam o Grupo Beija-flor" },
  { id: "docs",          title: "Documentos & Políticas",  description: "Leia os documentos do Grupo Beija-flor para continuar" },
  { id: "image_term",    title: "Uso de Imagem",           description: "Leia e decida sobre o uso da sua imagem e voz" },
  { id: "summary",       title: "Quase lá!",               description: "Revise o que foi concluído e acesse o aplicativo" },
];

// ─── Máscaras ─────────────────────────────────────────────────────────────────
function maskCPF(val: string): string {
  const d = val.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function maskPhone(val: string): string {
  const d = val.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function maskDate(val: string): string {
  const d = val.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

function validateDate(val: string): boolean {
  if (val.length !== 10) return false;
  const [dd, mm, yyyy] = val.split("/").map(Number);
  if (!dd || !mm || !yyyy) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  if (yyyy < 1900 || yyyy > 2100) return false;
  return true;
}

// ─── Company values ───────────────────────────────────────────────────────────
const COMPANY_VALUES = [
  { icon: "users", color: "#2563EB", colorBg: "#EFF6FF", title: "Pessoas em Primeiro Lugar", desc: "Valorizamos cada pessoa do nosso grupo. Colaboradores, clientes e parceiros são a base de tudo." },
  { icon: "heart", color: "#DC2626", colorBg: "#FEF2F2", title: "Comprometimento", desc: "Somos comprometidos com a qualidade, a pontualidade e com a entrega do nosso melhor a cada dia." },
  { icon: "star", color: "#D97706", colorBg: "#FFFBEB", title: "Respeito e Integridade", desc: "Agimos com ética, honestidade e respeito em todas as relações, dentro e fora do grupo." },
  { icon: "trending-up", color: "#059669", colorBg: "#F0FDF4", title: "Inovação e Crescimento", desc: "Buscamos sempre melhorar, aprender e evoluir. A inovação faz parte do nosso DNA." },
  { icon: "shield", color: "#7C3AED", colorBg: "#F5F3FF", title: "Responsabilidade Social", desc: "Contribuímos para a sociedade com ações que vão além do negócio, impactando positivamente nossa comunidade." },
];

// ─── IntegraItem type ─────────────────────────────────────────────────────────
type IntegraItem = {
  id: number; category: string; sectionName: string | null; sectionIcon: string | null;
  sectionColor: string | null; sectionColorBg: string | null; title: string; subtitle: string | null;
  content: string | null; pdfUrl: string | null; requiresSign: boolean; requiresRead: boolean;
  docKey: string; iconName: string | null; sortOrder: number; isActive: boolean;
  docType: string; showInIntegra: boolean; showInOnboarding: boolean; countsForProgress: boolean;
  confirmationText: string | null;
};

// ─── PolicyCard ───────────────────────────────────────────────────────────────
function PolicyCard({ item, color, colorBg, isRead, onToggle }: {
  item: IntegraItem; color: string; colorBg: string; isRead: boolean; onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[pStyles.card, isRead && pStyles.cardRead]}>
      <TouchableOpacity style={pStyles.cardHeader} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={[pStyles.icon, { backgroundColor: colorBg }]}>
          <Feather name={(item.iconName as any) || "file-text"} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={pStyles.titleRow}>
            <Text style={pStyles.title} numberOfLines={expanded ? undefined : 1}>{item.title}</Text>
            {item.requiresRead && !isRead && (
              <View style={pStyles.reqBadge}><Text style={pStyles.reqText}>Obrigatório</Text></View>
            )}
            {isRead && (
              <View style={pStyles.doneBadge}>
                <Feather name="check" size={9} color="#059669" />
                <Text style={pStyles.doneText}>Lido</Text>
              </View>
            )}
          </View>
          {!expanded && <Text style={pStyles.subtitle} numberOfLines={2}>{item.subtitle}</Text>}
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-right"} size={16} color={C.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
      {expanded && (
        <View style={pStyles.body}>
          <View style={pStyles.divider} />
          <RichText content={item.content || ""} baseSize={13} />
          <TouchableOpacity style={[pStyles.readRow, isRead && pStyles.readRowDone]} onPress={onToggle} disabled={isRead} activeOpacity={0.8}>
            <View style={[pStyles.checkbox, isRead && pStyles.checkboxDone]}>
              {isRead && <Feather name="check" size={11} color="#fff" />}
            </View>
            <Text style={[pStyles.readLabel, isRead && pStyles.readLabelDone]}>
              {isRead ? "Marcado como lido" : "Marcar como lido"}
            </Text>
            {isRead && <Feather name="check-circle" size={13} color="#059669" />}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const pStyles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8, overflow: "hidden" },
  cardRead: { borderColor: "#BBF7D0" },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  subtitle: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  reqBadge: { backgroundColor: "#FEE2E2", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  reqText: { fontSize: 9, color: "#DC2626", fontFamily: "Inter_600SemiBold" },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#DCFCE7", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  doneText: { fontSize: 9, color: "#059669", fontFamily: "Inter_600SemiBold" },
  body: { paddingHorizontal: 12, paddingBottom: 12 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 10 },
  readRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.border },
  readRowDone: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  checkboxDone: { backgroundColor: "#059669", borderColor: "#059669" },
  readLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  readLabelDone: { color: "#059669" },
});

// ─── MaskedInput ──────────────────────────────────────────────────────────────
function MaskedInput({ label, value, onChangeText, mask, placeholder, icon, keyboardType, required, error }: {
  label: string; value: string; onChangeText: (v: string) => void;
  mask: (v: string) => string; placeholder: string; icon: string;
  keyboardType?: any; required?: boolean; error?: string;
}) {
  return (
    <View style={mStyles.field}>
      <View style={mStyles.labelRow}>
        <Text style={mStyles.label}>{label}</Text>
        {required && <Text style={mStyles.req}>*</Text>}
      </View>
      <View style={[mStyles.inputWrap, error ? mStyles.inputWrapError : null]}>
        <Feather name={icon as any} size={16} color={error ? "#DC2626" : C.textSecondary} style={mStyles.inputIcon} />
        <TextInput
          style={mStyles.input}
          value={value}
          onChangeText={(text) => onChangeText(mask(text))}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType={keyboardType || "default"}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      {error && <Text style={mStyles.error}>{error}</Text>}
    </View>
  );
}

const mStyles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  req: { fontSize: 13, color: "#DC2626", fontFamily: "Inter_700Bold" },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 48 },
  inputWrapError: { borderColor: "#DC2626" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  error: { fontSize: 11, color: "#DC2626", fontFamily: "Inter_400Regular" },
});

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Photo
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl || null);

  // Step 2: Personal Data
  const [cpf, setCpf] = useState(user?.cpf ? maskCPF(user.cpf.replace(/\D/g, "")) : "");
  const [phone, setPhone] = useState(user?.phone ? maskPhone(user.phone.replace(/\D/g, "")) : "");
  const [birthDate, setBirthDate] = useState(user?.birthDate || "");
  const [admissionDate, setAdmissionDate] = useState(user?.admissionDate || "");
  const [sector, setSector] = useState(user?.sector || "");
  const [unit, setUnit] = useState(user?.unit || "");
  const [position, setPosition] = useState(user?.position || "");
  const [personalErrors, setPersonalErrors] = useState<Record<string, string>>({});

  // Step 3: Company values
  const [valuesConfirmed, setValuesConfirmed] = useState(false);

  // Step 4: Documents
  const [onboardingItems, setOnboardingItems] = useState<IntegraItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());

  // Step 5: Image term
  const [imageTermChoice, setImageTermChoice] = useState<boolean | null>(user?.imageTermAccepted ?? null);
  const [showImageTermConfirm, setShowImageTermConfirm] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<boolean | null>(null);

  useEffect(() => {
    api.get("/integra-items/onboarding")
      .then((data: IntegraItem[]) => setOnboardingItems(data))
      .catch(() => {})
      .finally(() => setItemsLoading(false));
  }, []);

  const policyItems = onboardingItems.filter((i) => !i.requiresSign);
  const termItems = onboardingItems.filter((i) => i.requiresSign);
  const firstTerm = termItems[0] || null;

  const sectionMap = new Map<string, { icon: string; color: string; colorBg: string; items: IntegraItem[] }>();
  for (const item of policyItems) {
    const sName = item.sectionName || item.category || "Outros";
    if (!sectionMap.has(sName)) {
      sectionMap.set(sName, { icon: item.sectionIcon || "file-text", color: item.sectionColor || C.tint, colorBg: item.sectionColorBg || "#EFF6FF", items: [] });
    }
    sectionMap.get(sName)!.items.push(item);
  }
  const policySections = Array.from(sectionMap.entries()).map(([section, data]) => ({ section, ...data }));
  const requiredKeys = policyItems.filter((i) => i.requiresRead).map((i) => i.docKey);
  const requiredDone = requiredKeys.every((k) => readKeys.has(k));

  function toggleRead(key: string) {
    setReadKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Photo ──────────────────────────────────────────────────────────────────
  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      try { await api.post(`/users/${user?.id}/avatar`, { avatarUrl: uri }); } catch {}
    }
  }

  // ── Personal data validation ───────────────────────────────────────────────
  function validatePersonal(): boolean {
    const errs: Record<string, string> = {};
    if (cpf.replace(/\D/g, "").length < 11) errs.cpf = "CPF deve ter 11 dígitos";
    if (phone.replace(/\D/g, "").length < 10) errs.phone = "Telefone deve ter ao menos 10 dígitos";
    if (!validateDate(birthDate)) errs.birthDate = "Data inválida. Use DD/MM/AAAA";
    if (!validateDate(admissionDate)) errs.admissionDate = "Data inválida. Use DD/MM/AAAA";
    setPersonalErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function savePersonalData() {
    if (!validatePersonal()) return false;
    try {
      const updated = await api.put("/auth/update-profile", {
        cpf: cpf.replace(/\D/g, ""),
        phone: phone.replace(/\D/g, ""),
        birthDate,
        admissionDate,
        sector: sector || null,
        unit: unit || null,
        position: position || null,
      });
      updateUser(updated);
      await api.post("/auth/onboarding-step", { step: "personal_data" });
      return true;
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível salvar os dados");
      return false;
    }
  }

  // ── Company values ─────────────────────────────────────────────────────────
  async function confirmValues() {
    try {
      await api.post("/auth/company-values-confirm", { context: "onboarding" });
      setValuesConfirmed(true);
    } catch {}
  }

  // ── Image term ─────────────────────────────────────────────────────────────
  function promptImageTermChoice(choice: boolean) {
    setPendingChoice(choice);
    setShowImageTermConfirm(true);
  }

  async function confirmImageTermChoice() {
    if (pendingChoice === null) return;
    setShowImageTermConfirm(false);
    try {
      await api.post("/auth/image-term-choice", { accepted: pendingChoice, context: "onboarding" });
      for (const term of termItems) {
        try { await api.post("/docs/mark", { documentKey: term.docKey }); } catch {}
        try {
          await api.post("/terms/accept", { termKey: term.docKey, termTitle: term.title });
        } catch {}
      }
      setImageTermChoice(pendingChoice);
      await api.post("/auth/onboarding-step", { step: pendingChoice ? "image_term_accepted" : "image_term_refused" });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  // ── Can proceed ────────────────────────────────────────────────────────────
  function canProceed(): boolean {
    switch (currentStep) {
      case 0: return true;
      case 1: return true;
      case 2: return valuesConfirmed;
      case 3: return requiredDone || itemsLoading;
      case 4: return imageTermChoice !== null;
      case 5: return true;
      default: return true;
    }
  }

  // ── Next step ──────────────────────────────────────────────────────────────
  async function nextStep() {
    if (currentStep === 1) {
      const ok = await savePersonalData();
      if (!ok) return;
    }
    if (currentStep === 3) {
      // Mark docs as read
      for (const key of Array.from(readKeys)) {
        try { await api.post("/docs/mark", { documentKey: key }); } catch {}
      }
      await api.post("/auth/onboarding-step", { step: "docs" }).catch(() => {});
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
    } else {
      await finishOnboarding();
    }
  }

  async function finishOnboarding() {
    setLoading(true);
    try {
      const updated = await api.post("/auth/complete-onboarding", {
        avatarUrl: avatarUri || user?.avatarUrl,
        acceptedTerms: true,
        readDocuments: readKeys.size > 0,
      });
      updateUser(updated);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }

  const step = STEPS[currentStep];
  const progressPct = ((currentStep + 1) / STEPS.length) * 100;

  // ── Summary items ──────────────────────────────────────────────────────────
  const summaryItems = [
    { label: "Foto de perfil", done: !!avatarUri, icon: "camera" },
    { label: "Dados pessoais", done: cpf.length > 0 && phone.length > 0, icon: "user" },
    { label: "Valores da empresa", done: valuesConfirmed, icon: "star" },
    { label: "Documentos lidos", done: readKeys.size > 0, icon: "book-open" },
    {
      label: imageTermChoice === null ? "Uso de imagem — sem resposta" : imageTermChoice ? "Uso de imagem — aceito" : "Uso de imagem — recusado",
      done: imageTermChoice !== null,
      icon: "camera",
      accent: imageTermChoice === false ? "#DC2626" : undefined,
    },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* ── Progress bar ── */}
        <View style={styles.header}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.stepLabel}>
            Passo {currentStep + 1} de {STEPS.length} — {step.title}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.desc}>{step.description}</Text>

          {/* ── Step 0: Photo ───────────────────────────────────────────────── */}
          {currentStep === 0 && (
            <View style={styles.photoSection}>
              <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderIcon}>📷</Text>
                    <Text style={styles.avatarPlaceholderText}>Toque para escolher</Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Feather name="camera" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              {avatarUri && (
                <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
                  <Text style={styles.changePhotoLink}>Trocar foto</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.photoHint}>Você pode adicionar ou trocar a foto depois</Text>
            </View>
          )}

          {/* ── Step 1: Personal Data ────────────────────────────────────────── */}
          {currentStep === 1 && (
            <View style={styles.formSection}>
              <MaskedInput label="CPF" value={cpf} onChangeText={setCpf} mask={maskCPF} placeholder="000.000.000-00" icon="credit-card" keyboardType="number-pad" required error={personalErrors.cpf} />
              <MaskedInput label="Telefone" value={phone} onChangeText={setPhone} mask={maskPhone} placeholder="(00) 00000-0000" icon="phone" keyboardType="number-pad" required error={personalErrors.phone} />
              <MaskedInput label="Data de Nascimento" value={birthDate} onChangeText={setBirthDate} mask={maskDate} placeholder="DD/MM/AAAA" icon="calendar" keyboardType="number-pad" required error={personalErrors.birthDate} />
              <MaskedInput label="Data de Admissão" value={admissionDate} onChangeText={setAdmissionDate} mask={maskDate} placeholder="DD/MM/AAAA" icon="briefcase" keyboardType="number-pad" required error={personalErrors.admissionDate} />

              <View style={styles.dividerLine} />
              <Text style={styles.sectionSub}>Informações de trabalho (opcional)</Text>

              <View style={mStyles.field}>
                <Text style={mStyles.label}>Cargo / Função</Text>
                <View style={mStyles.inputWrap}>
                  <Feather name="tag" size={16} color={C.textSecondary} style={mStyles.inputIcon} />
                  <TextInput style={mStyles.input} value={position} onChangeText={setPosition} placeholder="Ex: Operador de Caixa" placeholderTextColor={C.textMuted} />
                </View>
              </View>

              <View style={mStyles.field}>
                <Text style={mStyles.label}>Setor</Text>
                <View style={mStyles.inputWrap}>
                  <Feather name="layers" size={16} color={C.textSecondary} style={mStyles.inputIcon} />
                  <TextInput style={mStyles.input} value={sector} onChangeText={setSector} placeholder="Ex: Recursos Humanos" placeholderTextColor={C.textMuted} />
                </View>
              </View>

              <View style={mStyles.field}>
                <Text style={mStyles.label}>Unidade</Text>
                <View style={mStyles.inputWrap}>
                  <Feather name="map-pin" size={16} color={C.textSecondary} style={mStyles.inputIcon} />
                  <TextInput style={mStyles.input} value={unit} onChangeText={setUnit} placeholder="Ex: Unidade Centro" placeholderTextColor={C.textMuted} />
                </View>
              </View>

              <View style={styles.hintBox}>
                <Feather name="lock" size={13} color="#2563EB" />
                <Text style={styles.hintText}>Seus dados são protegidos e usados apenas internamente pelo Grupo Beija-flor.</Text>
              </View>
            </View>
          )}

          {/* ── Step 2: Company Values ───────────────────────────────────────── */}
          {currentStep === 2 && (
            <View style={styles.valuesSection}>
              {COMPANY_VALUES.map((v, i) => (
                <View key={i} style={[styles.valueCard, { borderLeftColor: v.color }]}>
                  <View style={[styles.valueIcon, { backgroundColor: v.colorBg }]}>
                    <Feather name={v.icon as any} size={18} color={v.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.valueTitle}>{v.title}</Text>
                    <Text style={styles.valueDesc}>{v.desc}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.confirmValuesBtn, valuesConfirmed && styles.confirmValuesBtnDone]}
                onPress={confirmValues}
                disabled={valuesConfirmed}
                activeOpacity={0.8}
              >
                <View style={[styles.confirmCheckbox, valuesConfirmed && styles.confirmCheckboxDone]}>
                  {valuesConfirmed && <Feather name="check" size={13} color="#fff" />}
                </View>
                <Text style={[styles.confirmValuesText, valuesConfirmed && styles.confirmValuesTextDone]}>
                  {valuesConfirmed ? "✓ Confirmei que li e estou ciente dos valores" : "Confirmar que li e estou ciente dos valores"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 3: Documents ───────────────────────────────────────────── */}
          {currentStep === 3 && (
            <View style={{ gap: 0, marginTop: 8 }}>
              {itemsLoading ? (
                <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
              ) : (
                <>
                  <View style={styles.readProgress}>
                    <Feather name="book-open" size={14} color={C.tint} />
                    <Text style={styles.readProgressText}>{readKeys.size} de {policyItems.length} lidos</Text>
                    {requiredDone && (
                      <View style={styles.allDoneBadge}>
                        <Feather name="check-circle" size={12} color="#059669" />
                        <Text style={styles.allDoneText}>Obrigatórios concluídos</Text>
                      </View>
                    )}
                  </View>
                  {policySections.map((sec) => (
                    <View key={sec.section} style={{ marginBottom: 16 }}>
                      <View style={[styles.sectionHeader, { backgroundColor: sec.colorBg }]}>
                        <View style={[styles.sectionIconWrap, { backgroundColor: sec.color + "22" }]}>
                          <Feather name={sec.icon as any} size={14} color={sec.color} />
                        </View>
                        <Text style={[styles.sectionTitle, { color: sec.color }]}>{sec.section}</Text>
                      </View>
                      {sec.items.map((item) => (
                        <PolicyCard
                          key={item.docKey} item={item} color={sec.color} colorBg={sec.colorBg}
                          isRead={readKeys.has(item.docKey)} onToggle={() => toggleRead(item.docKey)}
                        />
                      ))}
                    </View>
                  ))}
                  {!requiredDone && (
                    <View style={[styles.hintBox, { borderColor: "#FDE68A" }]}>
                      <Feather name="info" size={13} color="#92400E" />
                      <Text style={[styles.hintText, { color: "#92400E" }]}>Leia e marque todos os itens obrigatórios para continuar</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* ── Step 4: Image Term ───────────────────────────────────────────── */}
          {currentStep === 4 && (
            <View style={styles.documentSection}>
              {firstTerm ? (
                <>
                  <View style={styles.termHeaderCard}>
                    <View style={styles.termHeaderIcon}>
                      <Feather name="camera" size={20} color={C.tint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.termHeaderTitle}>{firstTerm.title}</Text>
                      {firstTerm.subtitle && <Text style={styles.termHeaderSub}>{firstTerm.subtitle}</Text>}
                    </View>
                  </View>
                  <View style={styles.documentCard}>
                    <ScrollView style={styles.documentScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      <RichText content={firstTerm.content || ""} baseSize={13} />
                    </ScrollView>
                  </View>
                </>
              ) : itemsLoading ? (
                <ActivityIndicator size="large" color={C.tint} />
              ) : (
                <View style={styles.termHeaderCard}>
                  <Feather name="camera" size={20} color={C.tint} />
                  <Text style={styles.termHeaderTitle}>Nenhum termo de imagem cadastrado</Text>
                </View>
              )}

              {imageTermChoice === null ? (
                <View style={styles.imageTermBtns}>
                  <Text style={styles.imageTermQuestion}>Você autoriza o uso da sua imagem e voz?</Text>
                  <TouchableOpacity style={styles.imageTermAccept} onPress={() => promptImageTermChoice(true)} activeOpacity={0.8}>
                    <Feather name="check-circle" size={18} color="#fff" />
                    <Text style={styles.imageTermAcceptText}>Aceitar e assinar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageTermRefuse} onPress={() => promptImageTermChoice(false)} activeOpacity={0.8}>
                    <Feather name="x-circle" size={18} color={C.textSecondary} />
                    <Text style={styles.imageTermRefuseText}>Não aceitar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.imageTermResult, imageTermChoice ? styles.imageTermResultAccepted : styles.imageTermResultRefused]}>
                  <Feather name={imageTermChoice ? "check-circle" : "x-circle"} size={20} color={imageTermChoice ? "#059669" : "#DC2626"} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.imageTermResultTitle, { color: imageTermChoice ? "#059669" : "#DC2626" }]}>
                      {imageTermChoice ? "Termo aceito e assinado" : "Termo não aceito — registrado"}
                    </Text>
                    <Text style={styles.imageTermResultSub}>
                      {imageTermChoice ? "Você autorizou o uso da sua imagem." : "Sua recusa foi registrada formalmente."}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setImageTermChoice(null)} activeOpacity={0.7}>
                    <Text style={styles.changeChoice}>Alterar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Step 5: Summary ──────────────────────────────────────────────── */}
          {currentStep === 5 && (
            <View style={styles.summarySection}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryEmoji}>🎉</Text>
                <Text style={styles.summaryWelcome}>Bem-vindo(a) ao Grupo Beija-flor!</Text>
                <Text style={styles.summarySub}>Veja o resumo do que foi concluído neste acesso:</Text>
              </View>

              {summaryItems.map((item, i) => (
                <View key={i} style={styles.summaryRow}>
                  <View style={[styles.summaryIcon, item.done ? (item.accent ? { backgroundColor: "#FEE2E2" } : styles.summaryIconDone) : styles.summaryIconPending]}>
                    <Feather name={item.icon as any} size={15} color={item.done ? (item.accent || "#059669") : C.textMuted} />
                  </View>
                  <Text style={[styles.summaryLabel, !item.done && styles.summaryLabelPending]}>
                    {item.label}
                  </Text>
                  <Feather name={item.done ? "check" : "clock"} size={15} color={item.done ? "#059669" : C.textMuted} />
                </View>
              ))}

              <View style={styles.summaryNote}>
                <Feather name="info" size={13} color={C.tint} />
                <Text style={styles.summaryNoteText}>
                  Documentos e assinaturas pendentes ficam disponíveis na aba <Text style={{ fontFamily: "Inter_700Bold" }}>Integra</Text> do aplicativo.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {currentStep > 0 && currentStep < 5 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentStep((s) => s - 1)} activeOpacity={0.7}>
              <Feather name="arrow-left" size={16} color={C.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled, currentStep > 0 && currentStep < 5 && { flex: 1 }]}
            onPress={nextStep}
            disabled={!canProceed() || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {currentStep === STEPS.length - 1 ? "Entrar no Aplicativo" : "Continuar"}
                </Text>
                <Feather name={currentStep === STEPS.length - 1 ? "log-in" : "arrow-right"} size={16} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Image term confirmation modal ── */}
        <Modal visible={showImageTermConfirm} transparent animationType="fade" onRequestClose={() => setShowImageTermConfirm(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconWrap, { backgroundColor: pendingChoice ? "#DCFCE7" : "#FEE2E2" }]}>
                  <Feather name={pendingChoice ? "check-circle" : "x-circle"} size={20} color={pendingChoice ? "#059669" : "#DC2626"} />
                </View>
                <Text style={styles.modalTitle}>{pendingChoice ? "Aceitar Uso de Imagem" : "Recusar Uso de Imagem"}</Text>
              </View>

              <View style={[styles.modalWarning, { borderColor: pendingChoice ? "#BBF7D0" : "#FCA5A5", backgroundColor: pendingChoice ? "#F0FDF4" : "#FFF1F1" }]}>
                <Text style={[styles.modalWarningText, { color: pendingChoice ? "#065F46" : "#7F1D1D" }]}>
                  {pendingChoice
                    ? `${firstTerm?.confirmationText || "Declaro que li o termo de uso de imagem e AUTORIZO o uso da minha imagem e voz pelo Grupo Beija-flor em materiais institucionais."}`
                    : "Confirmo que li o termo e NÃO AUTORIZO o uso da minha imagem e voz. Minha recusa será registrada formalmente."}
                </Text>
              </View>

              <View style={styles.modalUserCard}>
                <Feather name="user" size={14} color={C.textSecondary} />
                <Text style={styles.modalUserLabel}>Assinante:</Text>
                <Text style={styles.modalUserValue}>{user?.name || "—"}</Text>
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowImageTermConfirm(false)} activeOpacity={0.8}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: pendingChoice ? "#059669" : "#DC2626" }]}
                  onPress={confirmImageTermChoice} activeOpacity={0.8}
                >
                  <Feather name={pendingChoice ? "check" : "x"} size={15} color="#fff" />
                  <Text style={styles.modalConfirmText}>{pendingChoice ? "Aceitar e assinar" : "Confirmar recusa"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: { paddingHorizontal: 24, paddingVertical: 14 },
  progressBarBg: { height: 6, backgroundColor: C.border, borderRadius: 3, marginBottom: 10, overflow: "hidden" },
  progressBarFill: { height: 6, backgroundColor: C.tint, borderRadius: 3 },
  stepLabel: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_500Medium" },

  content: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 16, gap: 16 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: C.text },
  desc: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 22 },

  photoSection: { alignItems: "center", gap: 16, marginTop: 16 },
  avatarContainer: { width: 140, height: 140, borderRadius: 70, position: "relative" },
  avatar: { width: 140, height: 140, borderRadius: 70 },
  avatarPlaceholder: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: C.surfaceAlt, borderWidth: 2, borderColor: C.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  avatarPlaceholderIcon: { fontSize: 32 },
  avatarPlaceholderText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  avatarEditBadge: {
    position: "absolute", bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff",
  },
  changePhotoLink: { fontSize: 14, color: C.tint, fontFamily: "Inter_600SemiBold" },
  photoHint: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },

  formSection: { gap: 14 },
  dividerLine: { height: 1, backgroundColor: C.border },
  sectionSub: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  hintBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#BFDBFE",
  },
  hintText: { flex: 1, fontSize: 12, color: "#1D4ED8", fontFamily: "Inter_400Regular", lineHeight: 18 },

  valuesSection: { gap: 10 },
  valueCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, borderLeftWidth: 4,
  },
  valueIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  valueTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4 },
  valueDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  confirmValuesBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: C.border,
  },
  confirmValuesBtnDone: { borderColor: "#059669", backgroundColor: "#F0FDF4" },
  confirmCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  confirmCheckboxDone: { backgroundColor: "#059669", borderColor: "#059669" },
  confirmValuesText: { flex: 1, fontSize: 14, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  confirmValuesTextDone: { color: "#059669", fontFamily: "Inter_600SemiBold" },

  readProgress: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginBottom: 12,
  },
  readProgressText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint, flex: 1 },
  allDoneBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DCFCE7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  allDoneText: { fontSize: 10, color: "#059669", fontFamily: "Inter_600SemiBold" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 8, marginBottom: 6 },
  sectionIconWrap: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },

  documentSection: { gap: 14 },
  termHeaderCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#BFDBFE" },
  termHeaderIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.tint + "22", alignItems: "center", justifyContent: "center" },
  termHeaderTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.tint },
  termHeaderSub: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  documentCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  documentScroll: { maxHeight: 240, padding: 16 },

  imageTermBtns: { gap: 10 },
  imageTermQuestion: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text, textAlign: "center", marginBottom: 4 },
  imageTermAccept: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#059669", borderRadius: 12, paddingVertical: 16,
  },
  imageTermAcceptText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  imageTermRefuse: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 12, paddingVertical: 16,
    borderWidth: 1.5, borderColor: C.border,
  },
  imageTermRefuseText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  imageTermResult: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 16, borderWidth: 1 },
  imageTermResultAccepted: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  imageTermResultRefused: { backgroundColor: "#FFF1F1", borderColor: "#FCA5A5" },
  imageTermResultTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  imageTermResultSub: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  changeChoice: { fontSize: 12, color: C.tint, fontFamily: "Inter_600SemiBold" },

  summarySection: { gap: 10 },
  summaryHeader: { alignItems: "center", gap: 6, paddingVertical: 12 },
  summaryEmoji: { fontSize: 48 },
  summaryWelcome: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  summarySub: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
  summaryRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border,
  },
  summaryIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  summaryIconDone: { backgroundColor: "#DCFCE7" },
  summaryIconPending: { backgroundColor: C.surfaceAlt },
  summaryLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  summaryLabelPending: { color: C.textSecondary },
  summaryNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#BFDBFE",
  },
  summaryNoteText: { flex: 1, fontSize: 12, color: "#1D4ED8", fontFamily: "Inter_400Regular", lineHeight: 18 },

  footer: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: C.background, flexDirection: "row", gap: 10 },
  backBtn: {
    width: 48, height: 52, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  nextBtn: {
    flex: 1, backgroundColor: C.tint, borderRadius: 12, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalSheet: { backgroundColor: C.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalWarning: { borderRadius: 10, padding: 14, borderWidth: 1 },
  modalWarningText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  modalUserCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12 },
  modalUserLabel: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  modalUserValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  modalConfirmBtn: { flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: C.tint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  modalConfirmText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
