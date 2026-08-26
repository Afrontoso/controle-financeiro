"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Bug,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Github,
  HeartHandshake,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Share2,
  Sun,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import { SuggestionModal } from "@/components/SuggestionModal";
import { DonateModal } from "@/components/DonateModal";

/** Definidas no build; sem nenhuma das duas a opção de apoio nem aparece. */
const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY ?? "";
const PIX_PAYLOAD = process.env.NEXT_PUBLIC_PIX_PAYLOAD ?? "";

interface MenuViewProps {
  onOpenCards: () => void;
  onGoToday: () => void;
}

export function MenuView({ onOpenCards, onGoToday }: MenuViewProps) {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const showToast = useToast();

  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);

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
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
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
          <MenuRow
            icon={CreditCard}
            label="cartões de crédito"
            hint="fatura no vencimento"
            onClick={onOpenCards}
          />

          {/* No desktop esse atalho já vive na barra lateral. */}
          <MenuRow
            icon={CalendarDays}
            label="ir pra hoje"
            onClick={onGoToday}
            className="md:hidden"
          />

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
