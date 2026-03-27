import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

export interface TicketCategory {
  label: string;
  icon: FeatherIconName;
  color: string;
  bg: string;
}

export const TICKET_CATEGORIES: TicketCategory[] = [
  { label: "Sistemas e Tecnologia",      icon: "monitor",        color: "#2563EB", bg: "#EFF6FF" },
  { label: "Estrutura e Equipamentos",   icon: "tool",           color: "#7C3AED", bg: "#F5F3FF" },
  { label: "Materiais e Compras",        icon: "shopping-bag",   color: "#D97706", bg: "#FFFBEB" },
  { label: "Pessoas (RH)",               icon: "users",          color: "#059669", bg: "#ECFDF5" },
  { label: "Pessoas (Financeiro)",       icon: "dollar-sign",    color: "#DC2626", bg: "#FEF2F2" },
  { label: "Comunicação e Solicitações", icon: "message-circle", color: "#0891B2", bg: "#ECFEFF" },
];
