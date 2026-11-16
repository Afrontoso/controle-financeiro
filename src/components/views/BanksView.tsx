"use client";

import {
  CreditCard,
  Eye,
  Landmark,
  PiggyBank,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Brl } from "@/components/ui/Brl";
import { investedTotal, liquidTotal, type BankSnapshotData } from "@/lib/openFinance";

/** Consentimento do Open Finance vence: avisa com esta antecedência. */
const CONSENT_WARNING_DAYS = 30;

interface BanksViewProps {
  syncedAt: string | null;
  snapshot: BankSnapshotData | null;
  syncing: boolean;
  today: Date;
  onSync: () => void;
}

/**
 * Open Finance como aba à parte: mostra o que os bancos dizem (contas,
 * cofrinhos, investimentos e cartões) sem tocar em nada do app. Nada daqui
 * vira lançamento; as outras telas seguem só com o que você lança.
 */
export function BanksView({ syncedAt, snapshot, syncing, today, onSync }: BanksViewProps) {
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <StatusCard syncedAt={syncedAt} snapshot={snapshot} syncing={syncing} today={today} onSync={onSync} />
        {snapshot && <MoneyCard snapshot={snapshot} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatusCard({
  syncedAt,
  snapshot,
  syncing,
  today,
  onSync,
}: {
  syncedAt: string | null;
  snapshot: BankSnapshotData | null;
  syncing: boolean;
  today: Date;
  onSync: () => void;
}) {
  const consentAlerts = (snapshot?.items ?? []).filter((item) => {
    if (!item.consentExpiresAt) return false;
    const days = (Date.parse(item.consentExpiresAt) - today.getTime()) / 86_400_000;
    return days <= CONSENT_WARNING_DAYS;
  });

  return (
    <section className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 place-items-center rounded-xl"
            style={{ background: "var(--entrada-soft)", color: "var(--entrada)" }}
          >
            <Landmark size={20} />
          </span>
          <div>
            <p className="font-semibold lowercase">open finance</p>
            <p className="text-xs lowercase text-fg-subtle">
              {syncedAt ? `lido em ${formatDateTime(syncedAt)}` : "ainda não sincronizado"} · todo dia às 8h
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium lowercase text-brand-fg disabled:opacity-60"
        >
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          {syncing ? "lendo os bancos..." : "sincronizar agora"}
        </button>
      </div>

      <p className="mt-3 flex gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs lowercase text-fg-muted">
        <Eye size={13} className="mt-0.5 shrink-0" />
        só leitura: esta aba é um espelho dos bancos. nada daqui entra nos seus lançamentos, cofres, cartões ou
        orçamentos.
      </p>

      {snapshot && snapshot.items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {snapshot.items.map((item) => {
            const ok = item.status === "UPDATED" && !item.error;
            return (
              <li
                key={item.id}
                className="rounded-full px-3 py-1 text-xs lowercase"
                style={
                  ok
                    ? { background: "var(--surface-2)", color: "var(--fg-muted)" }
                    : { background: "var(--saida-soft)", color: "var(--saida)" }
                }
                title={item.error ?? undefined}
              >
                {bankNameOfItem(item.id, snapshot)} · {ok ? "ok" : item.status.toLowerCase()}
                {item.consentExpiresAt && ` · autorização até ${item.consentExpiresAt.slice(0, 10).split("-").reverse().join("/")}`}
              </li>
            );
          })}
        </ul>
      )}

      {consentAlerts.length > 0 && (
        <p
          className="mt-3 flex gap-1.5 rounded-xl px-3 py-2 text-xs lowercase"
          style={{ background: "var(--saida-soft)", color: "var(--saida)" }}
        >
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          a autorização do open finance vence em menos de {CONSENT_WARNING_DAYS} dias. renove em meu.pluggy.ai
          para os dados continuarem chegando.
        </p>
      )}
    </section>
  );
}

/** Tudo o que o banco mostra hoje: contas, cofrinhos, investimentos e cartões. */
function MoneyCard({ snapshot }: { snapshot: BankSnapshotData }) {
  const contas = snapshot.accounts.filter((a) => a.type === "BANK");
  const cofrinhos = contas.flatMap((a) => (a.reserved ?? []).filter((r) => r.amount > 0).map((r) => ({ ...r, conta: a.name })));
  const cartoes = snapshot.accounts.filter((a) => a.type === "CREDIT");
  const investimentos = new Map<string, number>();
  for (const inv of snapshot.investments) {
    const label = investmentLabel(inv.type, inv.subtype);
    investimentos.set(label, (investimentos.get(label) ?? 0) + inv.balance);
  }
  const totalCofrinhos = cofrinhos.reduce((s, r) => s + r.amount, 0);
  const totalContas = contas.reduce((s, a) => s + a.balance, 0);
  const totalInvest = investedTotal(snapshot);
  const totalCartoes = cartoes.reduce((s, a) => s + a.balance, 0);

  return (
    <section className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
      <h2 className="text-base font-semibold lowercase">seu dinheiro nos bancos</h2>
      <p className="text-xs lowercase text-fg-muted">
        <Brl value={liquidTotal(snapshot) + totalInvest} /> entre contas, cofrinhos e investimentos
      </p>
      <div className="mt-1 grid grid-cols-1 gap-x-8 md:grid-cols-2 2xl:grid-cols-4">
        <MoneyGroup title="na conta" total={totalContas} icon={Landmark}>
          {contas.map((a) => (
            <MoneyLine key={a.id} label={a.name} value={a.balance} />
          ))}
          {contas.length === 0 && <Empty>nenhuma conta nos bancos.</Empty>}
        </MoneyGroup>
        <MoneyGroup title="cofrinhos" total={totalCofrinhos} icon={PiggyBank}>
          {cofrinhos.map((r, i) => (
            <MoneyLine key={`${r.conta}:${i}`} label={r.name || "sem nome"} value={r.amount} />
          ))}
          {cofrinhos.length === 0 && <Empty>o banco não mostra cofrinhos.</Empty>}
        </MoneyGroup>
        <MoneyGroup title="investimentos" total={totalInvest} icon={TrendingUp}>
          {[...investimentos].map(([label, value]) => (
            <MoneyLine key={label} label={label} value={value} />
          ))}
          {investimentos.size === 0 && <Empty>nada aplicado por aqui.</Empty>}
        </MoneyGroup>
        <MoneyGroup title="cartões · em uso" total={totalCartoes} icon={CreditCard}>
          {cartoes.map((a) => (
            <MoneyLine
              key={a.id}
              label={a.name}
              value={a.balance}
              hint={
                a.creditLimit ? (
                  <>
                    limite <Brl value={a.creditLimit} />
                  </>
                ) : undefined
              }
            />
          ))}
          {cartoes.length === 0 && <Empty>nenhum cartão nos bancos.</Empty>}
        </MoneyGroup>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function MoneyGroup({
  title,
  total,
  icon: Icon,
  children,
}: {
  title: string;
  total: number;
  icon: typeof Landmark;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        <Icon size={12} /> {title} · <Brl value={total} />
      </p>
      <ul className="mt-1 flex flex-col divide-y divide-border-base">{children}</ul>
    </div>
  );
}

function MoneyLine({ label, value, hint }: { label: string; value: number; hint?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0 truncate lowercase">
        {label}
        {hint && <span className="ml-2 text-[11px] text-fg-subtle">{hint}</span>}
      </span>
      <span className="shrink-0 font-semibold tabular">
        <Brl value={value} />
      </span>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1.5 text-xs lowercase text-fg-subtle">{children}</p>;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function bankNameOfItem(itemId: string, snapshot: BankSnapshotData): string {
  const account = snapshot.accounts.find((a) => a.itemId === itemId && a.type === "BANK");
  return account?.name.toLowerCase() ?? "banco";
}

function investmentLabel(type: string, subtype: string | null): string {
  if (subtype === "CDB" || subtype === "RDB") return "caixinhas e cdb";
  if (subtype === "TREASURY") return "tesouro direto";
  if (subtype === "REAL_ESTATE_FUND") return "fundos imobiliários";
  if (type === "EQUITY") return "ações";
  return (subtype ?? type).toLowerCase().replace(/_/g, " ");
}
