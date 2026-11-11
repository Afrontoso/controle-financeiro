"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CreditCard,
  Inbox,
  Landmark,
  Link2,
  Pencil,
  PiggyBank,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { Brl, KeepRs } from "@/components/ui/Brl";
import { TypeBadge } from "@/components/ui/TypeBadge";
import {
  investedTotal,
  isOutflow,
  liquidTotal,
  suggest,
  type BankSnapshotData,
  type BankTx,
  type Suggestion,
} from "@/lib/openFinance";
import { TX_TYPE_META, type Card, type Transaction, type TxType, type Vault } from "@/lib/types";
import type { ResolveAction } from "@/hooks/useOpenFinance";

/** Valor do seletor que cria um cartão no app a partir do cartão do banco. */
export const NEW_CARD = "__novo";

/** Consentimento do Open Finance vence: avisa com esta antecedência. */
const CONSENT_WARNING_DAYS = 30;

const EDITABLE_TYPES: TxType[] = ["saida", "gasto_diario", "cartao", "entrada", "investimento"];

interface BanksViewProps {
  syncedAt: string | null;
  snapshot: BankSnapshotData | null;
  pending: BankTx[];
  ignored: BankTx[];
  /** Lançamentos seus já reconhecidos por uma transação do banco. */
  linkedIds: string[];
  syncing: boolean;
  transactions: Transaction[];
  cards: Card[];
  vaults: Vault[];
  /** Saldo que o app projeta para hoje, para comparar com o do banco. */
  appBalanceToday: number;
  today: Date;
  onSync: () => void;
  onResolve: (actions: ResolveAction[]) => void;
  /** Lança a diferença entre banco e app como ajuste de saldo hoje. */
  onAdjustBalance: (diff: number) => void;
  /**
   * Vincula o cartão do app ao cartão do banco: um id vincula, null desvincula
   * e NEW_CARD cria um cartão no app a partir do do banco.
   */
  onLinkCard: (accountId: string, cardId: string | null) => void;
}

export function BanksView(props: BanksViewProps) {
  const { snapshot, pending, ignored, linkedIds, transactions, cards, vaults, today } = props;

  const suggestions = useMemo(() => {
    // Um lançamento seu só pode ser reconhecido por uma transação do banco.
    const used = new Set(linkedIds);
    const map = new Map<string, Suggestion>();
    for (const tx of pending) {
      const s = suggest(tx, { transactions, cards, vaults, linkedIds: used, bankTxs: pending });
      if (s.match) used.add(s.match.id);
      map.set(tx.id, s);
    }
    return map;
  }, [pending, transactions, cards, vaults, linkedIds]);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <StatusCard {...props} today={today} />
        {snapshot && <BalanceCard snapshot={snapshot} appBalance={props.appBalanceToday} onAdjust={props.onAdjustBalance} />}
        <InboxCard
          pending={pending}
          suggestions={suggestions}
          cards={cards}
          vaults={vaults}
          onResolve={props.onResolve}
        />
        {snapshot && <AccountsCard snapshot={snapshot} cards={cards} onLinkCard={props.onLinkCard} />}
        <IgnoredCard ignored={ignored} onResolve={props.onResolve} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatusCard({ syncedAt, snapshot, syncing, onSync, today }: BanksViewProps) {
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

function BalanceCard({
  snapshot,
  appBalance,
  onAdjust,
}: {
  snapshot: BankSnapshotData;
  appBalance: number;
  onAdjust: (diff: number) => void;
}) {
  const real = liquidTotal(snapshot);
  const investido = investedTotal(snapshot);
  const diff = real - appBalance;
  const bate = Math.abs(diff) < 1;

  return (
    <section className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
      <h2 className="mb-3 text-base font-semibold lowercase">saldo real × saldo do app</h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Figure label="nas contas" value={<Brl value={real} />} hint="saldo + cofrinhos" />
        <Figure label="o app diz hoje" value={<Brl value={appBalance} />} hint="saldo projetado" />
        <Figure
          label="diferença"
          value={<Brl value={diff} />}
          hint={bate ? "batendo" : diff > 0 ? "o banco tem mais" : "o banco tem menos"}
          color={bate ? "var(--entrada)" : "var(--saida)"}
        />
        <Figure label="investido" value={<Brl value={investido} />} hint="caixinhas, cdb, ações..." />
      </dl>
      {!bate && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-xs lowercase text-fg-muted">
            a diferença vem do que não está lançado no app (ou do saldo com que você começou). confirme a caixa de
            entrada primeiro; o que sobrar dá para acertar com um lançamento de ajuste hoje.
          </p>
          <button
            type="button"
            onClick={() => onAdjust(diff)}
            className="shrink-0 rounded-full border border-border-base px-3 py-1.5 text-xs font-medium lowercase hover:bg-surface"
          >
            lançar ajuste de <Brl value={diff} />
          </button>
        </div>
      )}
    </section>
  );
}

function InboxCard({
  pending,
  suggestions,
  cards,
  vaults,
  onResolve,
}: {
  pending: BankTx[];
  suggestions: Map<string, Suggestion>;
  cards: Card[];
  vaults: Vault[];
  onResolve: (actions: ResolveAction[]) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? pending : pending.slice(0, 25);

  const confirm = (tx: BankTx, s: Suggestion): ResolveAction =>
    s.action === "link" && s.match
      ? { id: tx.id, action: "link", transactionId: s.match.id }
      : {
          id: tx.id,
          action: "import",
          type: s.type,
          description: s.description,
          amount: s.amount,
          date: s.date,
          cardId: s.cardId,
          vaultId: s.vaultId,
        };

  // "Confirmar todas" só leva as que não dependem de decisão: compra de cartão sem cartão vinculado fica.
  const ready = pending.filter((tx) => {
    const s = suggestions.get(tx.id);
    return s && !(s.type === "cartao" && !s.cardId);
  });

  return (
    <section className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold lowercase">
          <Inbox size={18} /> caixa de entrada
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium tabular">{pending.length}</span>
        </h2>
        {ready.length > 1 && (
          <button
            type="button"
            onClick={() => onResolve(ready.map((tx) => confirm(tx, suggestions.get(tx.id)!)))}
            className="rounded-full border border-border-base px-3 py-1.5 text-xs font-medium lowercase hover:bg-surface-2"
          >
            confirmar as {ready.length} sugestões
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="py-8 text-center text-sm lowercase text-fg-subtle">
          nada novo do banco. a leitura automática roda todo dia às 8h.
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {visible.map((tx) => {
            const s = suggestions.get(tx.id)!;
            return (
              <li key={tx.id} className="rounded-xl px-2 py-2.5 hover:bg-surface-2">
                <InboxRow
                  tx={tx}
                  suggestion={s}
                  expanded={editing === tx.id}
                  onToggleEdit={() => setEditing((cur) => (cur === tx.id ? null : tx.id))}
                  onConfirm={() => onResolve([confirm(tx, s)])}
                  onIgnore={() => onResolve([{ id: tx.id, action: "ignore" }])}
                  onImportCustom={(custom) => {
                    setEditing(null);
                    onResolve([{ id: tx.id, action: "import", ...custom, amount: s.amount, date: s.date }]);
                  }}
                  cards={cards}
                  vaults={vaults}
                />
              </li>
            );
          })}
        </ul>
      )}
      {pending.length > 25 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full rounded-full py-2 text-sm lowercase text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          {showAll ? "ver menos" : `ver mais ${pending.length - 25}`}
        </button>
      )}
    </section>
  );
}

function InboxRow({
  tx,
  suggestion: s,
  expanded,
  onToggleEdit,
  onConfirm,
  onIgnore,
  onImportCustom,
  cards,
  vaults,
}: {
  tx: BankTx;
  suggestion: Suggestion;
  expanded: boolean;
  onToggleEdit: () => void;
  onConfirm: () => void;
  onIgnore: () => void;
  onImportCustom: (custom: { type: TxType; description: string; cardId: string | null; vaultId: string | null }) => void;
  cards: Card[];
  vaults: Vault[];
}) {
  const out = isOutflow(tx);
  const needsCard = s.type === "cartao" && !s.cardId;

  return (
    <div>
      {/* No celular os botões descem para uma linha própria: o nome precisa do espaço. */}
      <div className="flex flex-wrap items-start gap-x-3 md:flex-nowrap">
        <TypeBadge type={s.type} size={22} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="line-clamp-2 text-sm font-medium lowercase md:truncate">
              <KeepRs text={s.description} />
            </span>
            <span className="shrink-0 text-sm font-semibold tabular" style={{ color: out ? "var(--saida)" : "var(--entrada)" }}>
              {out ? "−" : "+"}
              <Brl value={s.amount} />
            </span>
          </p>
          <p className="mt-0.5 text-xs lowercase text-fg-subtle">
            {tx.date.split("-").reverse().slice(0, 2).join("/")} · {tx.accountName.toLowerCase()}
            {tx.bankStatus === "PENDING" && " · ainda processando no banco"}
          </p>
          <p
            className="mt-1 flex items-center gap-1 text-xs lowercase"
            style={{ color: s.action === "link" ? "var(--entrada)" : needsCard ? "var(--saida)" : "var(--fg-muted)" }}
          >
            {s.action === "link" && <Link2 size={12} className="shrink-0" />}
            <KeepRs text={s.note} />
          </p>
        </div>
        <div className="mt-1 flex basis-full items-center justify-end gap-1 md:mt-0 md:basis-auto md:gap-0.5">
          <RowButton label={s.action === "link" ? "Reconhecer e marcar como paga" : "Confirmar sugestão"} onClick={onConfirm} disabled={needsCard} accent>
            <Check size={16} />
          </RowButton>
          <RowButton label="Mudar antes de lançar" onClick={onToggleEdit}>
            {expanded ? <ChevronDown size={16} /> : <Pencil size={14} />}
          </RowButton>
          <RowButton label="Ignorar" onClick={onIgnore}>
            <X size={16} />
          </RowButton>
        </div>
      </div>
      {expanded && (
        <EditImport
          initial={s}
          cards={cards}
          vaults={vaults}
          onCancel={onToggleEdit}
          onSubmit={onImportCustom}
        />
      )}
    </div>
  );
}

function EditImport({
  initial,
  cards,
  vaults,
  onCancel,
  onSubmit,
}: {
  initial: Suggestion;
  cards: Card[];
  vaults: Vault[];
  onCancel: () => void;
  onSubmit: (custom: { type: TxType; description: string; cardId: string | null; vaultId: string | null }) => void;
}) {
  const [type, setType] = useState<TxType>(initial.type);
  const [description, setDescription] = useState(initial.description);
  const [cardId, setCardId] = useState<string | null>(initial.cardId ?? cards[0]?.id ?? null);
  const [vaultId, setVaultId] = useState<string | null>(initial.vaultId);
  const selectClass =
    "rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm lowercase outline-none focus:border-border-strong";

  return (
    <div className="animate-fade-in mt-2.5 ml-[34px] flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
      <div className="flex flex-wrap gap-1">
        {EDITABLE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className="rounded-full border px-2.5 py-1 text-xs lowercase transition-colors"
            style={
              type === t
                ? { background: TX_TYPE_META[t].softColor, borderColor: TX_TYPE_META[t].color, color: TX_TYPE_META[t].color }
                : { borderColor: "var(--border)" }
            }
          >
            {TX_TYPE_META[t].singular}
          </button>
        ))}
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${selectClass} w-full`} />
      {type === "cartao" && (
        <select value={cardId ?? ""} onChange={(e) => setCardId(e.target.value || null)} className={selectClass}>
          <option value="">sem cartão (sai no dia)</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {(type === "investimento" || type === "entrada") && vaults.length > 0 && (
        <select value={vaultId ?? ""} onChange={(e) => setVaultId(e.target.value || null)} className={selectClass}>
          <option value="">{type === "investimento" ? "sem cofre" : "não veio de cofre"}</option>
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>
              {type === "investimento" ? "guardar em" : "resgatado de"} {v.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full px-3 py-1.5 text-xs lowercase text-fg-muted hover:text-fg">
          cancelar
        </button>
        <button
          type="button"
          onClick={() =>
            onSubmit({
              type,
              description: description.trim() || initial.description,
              cardId: type === "cartao" ? cardId : null,
              vaultId: type === "investimento" || type === "entrada" ? vaultId : null,
            })
          }
          className="rounded-full px-3 py-1.5 text-xs font-medium lowercase text-white"
          style={{ background: TX_TYPE_META[type].color }}
        >
          lançar como {TX_TYPE_META[type].singular}
        </button>
      </div>
    </div>
  );
}

function AccountsCard({
  snapshot,
  cards,
  onLinkCard,
}: {
  snapshot: BankSnapshotData;
  cards: Card[];
  onLinkCard: (accountId: string, cardId: string | null) => void;
}) {
  const bankAccounts = snapshot.accounts.filter((a) => a.type === "BANK");
  const creditAccounts = snapshot.accounts.filter((a) => a.type === "CREDIT");
  const groups = new Map<string, number>();
  for (const inv of snapshot.investments) {
    const label = investmentLabel(inv.type, inv.subtype);
    groups.set(label, (groups.get(label) ?? 0) + inv.balance);
  }

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold lowercase">
          <Landmark size={17} /> contas
        </h2>
        <ul className="flex flex-col gap-3">
          {bankAccounts.map((a) => (
            <li key={a.id}>
              <p className="flex items-baseline justify-between gap-2 text-sm">
                <span className="lowercase">{a.name.toLowerCase()}</span>
                <span className="font-semibold tabular">
                  <Brl value={a.balance} />
                </span>
              </p>
              {(a.reserved ?? []).filter((r) => r.amount > 0).length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 border-l-2 border-border-base pl-3">
                  {(a.reserved ?? [])
                    .filter((r) => r.amount > 0)
                    .map((r, i) => (
                      <li key={`${r.name}-${i}`} className="flex justify-between gap-2 text-xs lowercase text-fg-muted">
                        <span className="flex items-center gap-1">
                          <PiggyBank size={11} /> {r.name.toLowerCase()}
                        </span>
                        <span className="tabular">
                          <Brl value={r.amount} />
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {groups.size > 0 && (
          <div className="mt-4 border-t border-border-base pt-3">
            <p className="mb-1.5 text-xs lowercase text-fg-muted">investimentos</p>
            <ul className="flex flex-col gap-0.5">
              {[...groups].map(([label, total]) => (
                <li key={label} className="flex justify-between gap-2 text-xs lowercase">
                  <span className="text-fg-muted">{label}</span>
                  <span className="tabular">
                    <Brl value={total} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold lowercase">
          <CreditCard size={17} /> cartões no banco
        </h2>
        <ul className="flex flex-col gap-4">
          {creditAccounts.map((a) => {
            const linked = cards.find((c) => c.pluggyAccountId === a.id) ?? null;
            const usado = a.creditLimit ? 1 - (a.availableCreditLimit ?? a.creditLimit) / a.creditLimit : 0;
            return (
              <li key={a.id}>
                <p className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="lowercase">{a.name.toLowerCase()}</span>
                  {a.creditLimit ? (
                    <span className="text-xs text-fg-muted tabular">
                      livre <Brl value={a.availableCreditLimit ?? 0} /> de <Brl value={a.creditLimit} />
                    </span>
                  ) : null}
                </p>
                {a.creditLimit ? (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(usado, 1) * 100}%`, background: usado > 0.8 ? "var(--saida)" : "var(--cartao)" }}
                    />
                  </div>
                ) : null}
                {a.balanceDueDate && (
                  <p className="mt-1 text-[11px] lowercase text-fg-subtle">
                    último vencimento {a.balanceDueDate.split("-").reverse().join("/")}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs lowercase">
                  <Link2 size={12} className="shrink-0 text-fg-subtle" />
                  <select
                    value={linked?.id ?? ""}
                    onChange={(e) => onLinkCard(a.id, e.target.value || null)}
                    className="min-w-0 flex-1 rounded-lg border border-border-base bg-surface px-2 py-1 lowercase outline-none"
                    aria-label={`Cartão do app para ${a.name}`}
                  >
                    <option value="">{linked ? "desvincular" : "vincular a um cartão do app..."}</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value={NEW_CARD}>+ criar cartão no app</option>
                  </select>
                </div>
              </li>
            );
          })}
          {creditAccounts.length === 0 && <p className="text-sm lowercase text-fg-subtle">nenhum cartão nos bancos.</p>}
        </ul>
      </div>
    </section>
  );
}

function IgnoredCard({ ignored, onResolve }: { ignored: BankTx[]; onResolve: (actions: ResolveAction[]) => void }) {
  const [open, setOpen] = useState(false);
  if (ignored.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-base font-semibold lowercase">ignoradas nos últimos 45 dias</span>
        <span className="flex items-center gap-1 text-xs lowercase text-fg-muted">
          {ignored.length} <ChevronDown size={14} className={open ? "rotate-180" : ""} />
        </span>
      </button>
      {open && (
        <ul className="mt-3 flex flex-col">
          {ignored.map((tx) => (
            <li key={tx.id} className="flex items-center gap-3 border-t border-border-base py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate lowercase">
                  <KeepRs text={tx.description.split("|").join(" · ")} />
                </span>
                <span className="block text-xs lowercase text-fg-subtle">
                  {tx.date.split("-").reverse().slice(0, 2).join("/")} · {tx.accountName.toLowerCase()} ·{" "}
                  <KeepRs text={tx.reason ?? ""} />
                </span>
              </span>
              <span className="shrink-0 text-xs text-fg-muted tabular">
                <Brl value={Math.abs(tx.amount)} />
              </span>
              <RowButton label="Trazer para a caixa de entrada" onClick={() => onResolve([{ id: tx.id, action: "restore" }])}>
                <RotateCcw size={14} />
              </RowButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function RowButton({
  label,
  onClick,
  disabled,
  accent,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-10 place-items-center rounded-full md:size-8 transition-colors disabled:opacity-30 ${
        accent ? "text-[var(--entrada)] hover:bg-entrada-soft" : "text-fg-subtle hover:bg-surface-3 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Figure({ label, value, hint, color }: { label: string; value: React.ReactNode; hint?: string; color?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-[11px] lowercase text-fg-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-bold tabular" style={color ? { color } : undefined}>
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-[11px] lowercase text-fg-subtle">{hint}</p>}
    </div>
  );
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
