import React, { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface DatePickerModalProps {
  /** Current value as ISO date string "YYYY-MM-DD" */
  value: string;
  onChange: (date: string) => void;
  label: string;
  /** Optional min/max as "YYYY-MM-DD" */
  minDate?: string;
  maxDate?: string;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatDisplay(s: string): string {
  const d = parseDate(s);
  if (!d) return "Selecionar data";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function DatePickerModal({
  value, onChange, label, minDate, maxDate,
}: DatePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const initialDate = parseDate(value) ?? new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [showYearPicker, setShowYearPicker] = useState(false);

  function openCalendar() {
    const d = parseDate(value) ?? new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setShowYearPicker(false);
    setOpen(true);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const selectedDate = parseDate(value);
  const minD = parseDate(minDate ?? "");
  const maxD = parseDate(maxDate ?? "");

  function isDisabled(day: number): boolean {
    const d = new Date(viewYear, viewMonth, day);
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  }
  function isSelected(day: number): boolean {
    return !!selectedDate &&
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day;
  }
  function isToday(day: number): boolean {
    const t = new Date();
    return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === day;
  }

  function selectDay(day: number) {
    if (isDisabled(day)) return;
    onChange(toISO(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }

  const years = useMemo(() => {
    const list: number[] = [];
    const cur = new Date().getFullYear();
    for (let y = cur - 5; y <= cur + 10; y++) list.push(y);
    return list;
  }, []);

  return (
    <>
      <TouchableOpacity style={st.trigger} onPress={openCalendar} activeOpacity={0.8}>
        <Feather name="calendar" size={15} color={value ? C.tint : C.textMuted} />
        <Text style={[st.triggerText, !value && st.triggerPlaceholder]}>
          {value ? formatDisplay(value) : "Selecionar data"}
        </Text>
        <Feather name="chevron-down" size={14} color={C.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[st.sheet, { marginBottom: Math.max(insets.bottom, 16) }]}>
            {/* Header */}
            <View style={st.header}>
              <TouchableOpacity onPress={prevMonth} style={st.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="chevron-left" size={20} color={C.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowYearPicker(!showYearPicker)} style={st.monthTitle} activeOpacity={0.7}>
                <Text style={st.monthTitleText}>{MONTHS[viewMonth]} {viewYear}</Text>
                <Feather name={showYearPicker ? "chevron-up" : "chevron-down"} size={14} color={C.tint} />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth} style={st.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="chevron-right" size={20} color={C.text} />
              </TouchableOpacity>
            </View>

            {/* Year picker */}
            {showYearPicker && (
              <View style={st.yearGrid}>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[st.yearCell, y === viewYear && st.yearCellActive]}
                    onPress={() => { setViewYear(y); setShowYearPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.yearCellText, y === viewYear && st.yearCellTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!showYearPicker && (
              <>
                {/* Weekday labels */}
                <View style={st.weekRow}>
                  {WEEKDAYS.map((w) => (
                    <Text key={w} style={st.weekLabel}>{w}</Text>
                  ))}
                </View>

                {/* Day grid */}
                <View style={st.dayGrid}>
                  {days.map((day, idx) => (
                    <View key={idx} style={st.dayCell}>
                      {day !== null ? (
                        <TouchableOpacity
                          style={[
                            st.dayBtn,
                            isSelected(day) && st.dayBtnSelected,
                            isToday(day) && !isSelected(day) && st.dayBtnToday,
                            isDisabled(day) && st.dayBtnDisabled,
                          ]}
                          onPress={() => selectDay(day)}
                          activeOpacity={0.7}
                          disabled={isDisabled(day)}
                        >
                          <Text style={[
                            st.dayText,
                            isSelected(day) && st.dayTextSelected,
                            isToday(day) && !isSelected(day) && st.dayTextToday,
                            isDisabled(day) && st.dayTextDisabled,
                          ]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Footer */}
            <TouchableOpacity style={st.clearBtn} onPress={() => { onChange(""); setOpen(false); }} activeOpacity={0.7}>
              <Text style={st.clearBtnText}>Limpar seleção</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  trigger: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  triggerText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  triggerPlaceholder: { color: C.textMuted },

  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.surface, borderRadius: 20,
    marginHorizontal: 12, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 20,
  },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  navBtn: { padding: 6 },
  monthTitle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  monthTitleText: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },

  yearGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  yearCell: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.background, borderWidth: 1, borderColor: C.border },
  yearCellActive: { backgroundColor: C.tint, borderColor: C.tint },
  yearCellText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  yearCellTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted },

  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayBtn: { flex: 1, borderRadius: 100, alignItems: "center", justifyContent: "center" },
  dayBtnSelected: { backgroundColor: C.tint },
  dayBtnToday: { borderWidth: 1.5, borderColor: C.tint },
  dayBtnDisabled: { opacity: 0.3 },
  dayText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.text },
  dayTextSelected: { color: "#fff", fontFamily: "Inter_700Bold" },
  dayTextToday: { color: C.tint, fontFamily: "Inter_700Bold" },
  dayTextDisabled: { color: C.textMuted },

  clearBtn: { alignItems: "center", paddingVertical: 10, marginTop: 8 },
  clearBtnText: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular" },
});
