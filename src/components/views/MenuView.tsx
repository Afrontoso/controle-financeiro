"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Bug,
  Building2,
  Landmark,
  PiggyBank,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  CreditCard,
  Github,
  LayoutGrid,
  HandCoins,
  HeartHandshake,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Settings,
  Share2,
  Sigma,
  Sun,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import { SuggestionModal } from "@/components/SuggestionModal";
import { DonateModal } from "@/components/DonateModal";
import { ResetDataModal } from "@/components/ResetDataModal";

/** Definidas no build; sem nenhuma das duas a opção de apoio nem aparece. */
const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY ?? "";
const PIX_PAYLOAD = process.env.NEXT_PUBLIC_PIX_PAYLOAD ?? "";

interface MenuViewProps {
  /** Telas que no celular não têm aba própria. */
  onOpenView: (view: "saldos" | "totais" | "orcamentos" | "cartoes" | "fluxo") => void;
  onOpenIncome: () => void;
  onOpenHorizon: () => void;
  /** Sem isso o apartamento está desligado em configurações. */
  onOpenApartment?: () => void;
  onOpenSettings: () => void;
  onOpenVaults: () => void;
  /** Só para quem tem Open Finance. */
  onOpenBanks?: () => void;
  onGoToday: () => void;
  onResetData: () => Promise<void>;
  dataCounts: { transactions: number; budgets: number; cards: number };
}

export function MenuView({ onOpenView, onOpenIncome, onOpenHorizon, onOpenApartment, onOpenSettings, onOpenVaults, onOpenBanks, onGoToday, onResetData, dataCounts }: MenuViewProps) {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const showToast = useToast();

  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const share = async () => {
    const url = window.location.origin;
    const data = {
      title: "controle financeiro",
      text: "um app de fluxo de caixa que projeta seu saldo dia a dia.",
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        // Compartilhamento cancelado pelo usuário: nada a fazer.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("link copiado.");
    } catch {
      showToast("não foi possível copiar o link.", "error");
    }
  };

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="flex flex-col gap-5">
        <header className="flex items-center gap-4 px-1">
          {session?.user?.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={session.user.image} alt="" className="size-14 shrink-0 rounded-full" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface-3 text-lg font-semibold">
              {session?.user?.name?.charAt(0) ?? "?"}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold">{session?.user?.name ?? "conta"}</h2>
            <p className="truncate text-sm text-fg-muted">{session?.user?.email}</p>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-border-base bg-surface">
          {/* No desktop estes atalhos já vivem na barra lateral; no celular, as abas de baixo têm visão, contas e fixos. */}
          <MenuRow icon={TrendingUp} label="fluxo de caixa" hint="entra e sai" onClick={() => onOpenView("fluxo")} className="md:hidden" />
          <MenuRow icon={CreditCard} label="cartões" hint="faturas" onClick={() => onOpenView("cartoes")} className="md:hidden" />
          <MenuRow icon={HandCoins} label="renda" hint="o que entra" onClick={onOpenIncome} className="md:hidden" />
          {onOpenApartment && (
            <MenuRow
              icon={Building2}
              label="apartamento"
              hint="financiamento"
              onClick={onOpenApartment}
              className="md:hidden"
            />
          )}
          <MenuRow
            icon={PiggyBank}
            label="cofres"
            hint="reserva e metas"
            onClick={onOpenVaults}
            className="md:hidden"
          />
          {onOpenBanks && (
            <MenuRow
              icon={Landmark}
              label="bancos"
              hint="open finance"
              onClick={onOpenBanks}
              className="md:hidden"
            />
          )}

          <MenuRow icon={LayoutGrid} label="saldos" hint="dia a dia" onClick={() => onOpenView("saldos")} className="md:hidden" />
          <MenuRow icon={Sigma} label="totais" hint="resumo do mês" onClick={() => onOpenView("totais")} className="md:hidden" />
          <MenuRow icon={Target} label="orçamentos" onClick={() => onOpenView("orcamentos")} className="md:hidden" />
          <MenuRow
            icon={CalendarRange}
            label="horizonte de saldos"
            onClick={onOpenHorizon}
            className="md:hidden"
          />

          <MenuRow
            icon={CalendarDays}
            label="ir pra hoje"
            onClick={onGoToday}
            className="md:hidden"
          />

          <MenuRow icon={Settings} label="configurações" hint="telas e barra lateral" onClick={onOpenSettings} />

          <MenuRow
            icon={theme === "dark" ? Sun : Moon}
            label={theme === "dark" ? "tema claro" : "tema escuro"}
            onClick={toggleTheme}
            chevron={false}
          />

          <MenuRow
            icon={MessageSquare}
            label="mandar sugestões"
            onClick={() => setSuggestionOpen(true)}
          />

          <MenuRow icon={Share2} label="compartilhar aplicação" onClick={() => void share()} />

          {(PIX_PAYLOAD || PIX_KEY) && (
            <MenuRow
              icon={HeartHandshake}
              label="apoiar com uma doação"
              hint="pix"
              onClick={() => setDonateOpen(true)}
            />
          )}

          <MenuRow icon={LogOut} label="sair" onClick={() => void signOut()} chevron={false} danger />
        </section>

        {/* Separado do resto de propósito: ninguém deve tocar aqui por engano. */}
        <section className="flex flex-col gap-2">
          <h3 className="px-2 text-xs font-medium lowercase text-fg-subtle">zona de perigo</h3>
          <div
            className="overflow-hidden rounded-2xl border bg-surface"
            style={{ borderColor: "var(--saida)" }}
          >
            <MenuRow
              icon={Trash2}
              label="zerar todos os dados"
              hint="irreversível"
              onClick={() => setResetOpen(true)}
              danger
            />
          </div>
        </section>

        <footer className="flex items-center justify-between px-2 pb-2 text-xs text-fg-subtle">
          <span className="lowercase">victor assis</span>
          <span className="flex items-center gap-3">
            <a href="mailto:victor2lra@gmail.com" title="E-mail" className="hover:text-fg">
              <Mail size={15} />
            </a>
            <a
              href="https://github.com/Afrontoso"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="hover:text-fg"
            >
              <Github size={15} />
            </a>
            <a
              href="mailto:victor2lra@gmail.com?subject=Bug%20no%20controle%20financeiro"
              title="Reportar bug"
              className="hover:text-fg"
            >
              <Bug size={15} />
            </a>
          </span>
        </footer>
      </div>

      {suggestionOpen && <SuggestionModal onClose={() => setSuggestionOpen(false)} />}
      {donateOpen && (
        <DonateModal
          pixKey={PIX_KEY}
          pixPayload={PIX_PAYLOAD}
          onClose={() => setDonateOpen(false)}
        />
      )}
      {resetOpen && (
        <ResetDataModal
          counts={dataCounts}
          onConfirm={onResetData}
          onClose={() => setResetOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MenuRow({
  icon: Icon,
  label,
  hint,
  onClick,
  chevron = true,
  danger,
  className = "",
}: {
  icon: typeof Mail;
  label: string;
  hint?: string;
  onClick: () => void;
  chevron?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 border-b border-border-base px-5 py-4 text-left transition-colors last:border-0 hover:bg-surface-2 ${
        danger ? "text-saida" : ""
      } ${className}`}
    >
      <Icon size={19} className={danger ? "" : "text-fg-subtle"} />
      <span className="min-w-0 flex-1 truncate lowercase">{label}</span>
      {hint && <span className="shrink-0 text-xs lowercase text-fg-subtle">{hint}</span>}
      {chevron && <ChevronRight size={18} className="shrink-0 text-fg-subtle" />}
    </button>
  );
}
