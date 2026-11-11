"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, PiggyBank, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Brl, KeepRs } from "@/components/ui/Brl";
import { formatCurrency, formatPercent } from "@/lib/format";
import { monthsToGoal, type FixedCost, type VaultBalance } from "@/lib/vaults";
import type { Vault } from "@/lib/types";

interface VaultsViewProps {
  balances: VaultBalance[];
  fixedCost: FixedCost;
  onCreate: (asReserve?: boolean) => void;
  onEdit: (vault: Vault) => void;
  onDelete: (vault: Vault) => void;
  /** Abre o modal de lançamento já ligado ao cofre: guardar = economia, resgatar = entrada. */
  onMove: (vault: Vault, kind: "guardar" | "resgatar") => void;
}

export function VaultsView({ balances, fixedCost, onCreate, onEdit, onDelete, onMove }: VaultsViewProps) {
  const reserva = balances.find((b) => b.vault.kind === "reserva");
  const outros = balances.filter((b) => b !== reserva);
  const total = balances.reduce((s, b) => s + b.saldo, 0);
  const previsto = balances.reduce((s, b) => s + b.previsto, 0);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <section className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border-base bg-surface p-4 md:p-5">
          <div>
            <p className="text-xs lowercase text-fg-muted">guardado em cofres</p>
            <p className="mt-1 text-3xl font-bold tabular md:text-4xl" style={{ color: "var(--economia)" }}>
              <Brl value={total} />
            </p>
            {previsto !== 0 && (
              <p className="mt-0.5 text-xs lowercase text-fg-subtle">
                {previsto > 0 ? "mais" : "menos"} <Brl value={Math.abs(previsto)} /> já agendados
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onCreate()}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold lowercase text-white"
            style={{ background: "var(--economia)" }}
          >
            <Plus size={16} /> novo cofre
          </button>
        </section>

        {reserva ? (
          <ReserveCard balance={reserva} fixedCost={fixedCost} onEdit={onEdit} onMove={onMove} />
        ) : (
          <button
            type="button"
            onClick={() => onCreate(true)}
            className="flex items-center gap-4 rounded-2xl border border-dashed border-border-strong p-5 text-left transition-colors hover:bg-surface-2"
          >
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl"
              style={{ background: "var(--economia-soft)", color: "var(--economia)" }}
            >
              <ShieldCheck size={22} />
            </span>
            <span>
              <span className="block font-semibold lowercase">criar a reserva de emergência</span>
              <span className="block text-sm lowercase text-fg-muted">
                {fixedCost.total > 0 ? (
                  <>
                    a referência é 6 meses do custo de vida fixo: <Brl value={fixedCost.total * 6} /> hoje.
                  </>
                ) : (
                  "o dinheiro que segura um imprevisto sem virar dívida. a referência é 6 meses do custo de vida fixo."
                )}
              </span>
            </span>
          </button>
        )}

        {outros.length > 0 && (
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {outros.map((b) => (
              <VaultCard key={b.vault.id} balance={b} onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
            ))}
          </section>
        )}

        {balances.length === 0 && (
          <p className="px-1 text-sm lowercase text-fg-subtle">
            cofres separam dinheiro para um fim sem tirar ele do controle: guardar num cofre é uma
            economia (sai do saldo), resgatar é uma entrada (volta para o saldo).
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReserveCard({
  balance,
  fixedCost,
  onEdit,
  onMove,
}: {
  balance: VaultBalance;
  fixedCost: FixedCost;
  onEdit: (vault: Vault) => void;
  onMove: (vault: Vault, kind: "guardar" | "resgatar") => void;
}) {
  const { vault, saldo, falta, progresso, noMes, meta, metaAutomatica } = balance;
  const mesesCobertos = fixedCost.total > 0 ? saldo / fixedCost.total : null;
  const prazo = monthsToGoal(balance, noMes);

  return (
    <section
      className="rounded-2xl border p-4 md:p-5"
      style={{ borderColor: "var(--economia)", background: "var(--economia-soft)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} style={{ color: "var(--economia)" }} />
          <h2 className="font-semibold lowercase">
            <KeepRs text={vault.name} />
          </h2>
        </div>
        <VaultActions vault={vault} onEdit={onEdit} onMove={onMove} />
      </div>

      <p className="mt-3 text-3xl font-bold tabular">
        <Brl value={saldo} />
        {meta && (
          <span className="ml-2 text-sm font-normal text-fg-muted">
            de <Brl value={meta} />
          </span>
        )}
      </p>
      {metaAutomatica && (
        <p className="mt-0.5 text-xs lowercase text-fg-muted">
          meta = {vault.goalMonths} meses × <Brl value={fixedCost.total} /> de custo fixo (
          <Brl value={fixedCost.recorrentes} /> recorrentes + <Brl value={fixedCost.orcamentos} /> de orçamentos)
        </p>
      )}

      {progresso !== null && (
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.min(progresso * 100, 100)}%`, background: "var(--economia)" }}
          />
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        {progresso !== null && <Mini label="da meta" value={formatPercent(progresso * 100, 0)} />}
        {falta !== null && <Mini label="falta" value={<Brl value={falta} />} />}
        {mesesCobertos !== null && (
          <Mini
            label="segura"
            value={`${mesesCobertos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${mesesCobertos >= 1 && mesesCobertos < 2 ? "mês" : "meses"}`}
            hint="do custo de vida fixo"
          />
        )}
        <Mini
          label="neste mês"
          value={<Brl value={noMes} />}
          hint={prazo ? `nesse ritmo, meta em ${prazo} ${prazo === 1 ? "mês" : "meses"}` : undefined}
        />
      </dl>
    </section>
  );
}

function VaultCard({
  balance,
  onEdit,
  onDelete,
  onMove,
}: {
  balance: VaultBalance;
  onEdit: (vault: Vault) => void;
  onDelete: (vault: Vault) => void;
  onMove: (vault: Vault, kind: "guardar" | "resgatar") => void;
}) {
  const [showMoves, setShowMoves] = useState(false);
  const { vault, saldo, falta, progresso, previsto, movimentos, meta } = balance;
  const atingida = progresso !== null && progresso >= 1;

  return (
    <article className="flex flex-col rounded-2xl border border-border-base bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl"
            style={{ background: "var(--economia-soft)", color: "var(--economia)" }}
          >
            <PiggyBank size={18} />
          </span>
          <h3 className="truncate font-medium lowercase">
            <KeepRs text={vault.name} />
          </h3>
        </div>
        <VaultActions vault={vault} onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
      </div>

      <p className="mt-3 text-xl font-bold tabular">
        <Brl value={saldo} />
        {meta && (
          <span className="ml-1.5 text-xs font-normal text-fg-muted">
            de <Brl value={meta} />
          </span>
        )}
      </p>

      {progresso !== null && (
        <>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.min(progresso * 100, 100)}%`, background: "var(--economia)" }}
            />
          </div>
          <p className="mt-1.5 text-[11px] lowercase text-fg-subtle">
            {atingida ? (
              "meta atingida"
            ) : (
              <>
                {formatPercent(progresso * 100, 0)} · falta <Brl value={falta ?? 0} />
              </>
            )}
          </p>
        </>
      )}
      {previsto !== 0 && (
        <p className="mt-1 text-[11px] lowercase text-fg-subtle">
          {previsto > 0 ? "+" : "−"}
          <Brl value={Math.abs(previsto)} /> agendado
        </p>
      )}

      {movimentos.length > 0 && (
        <div className="mt-3 border-t border-border-base pt-2">
          <button
            type="button"
            onClick={() => setShowMoves((v) => !v)}
            className="text-xs lowercase text-fg-muted hover:text-fg"
          >
            {showMoves ? "esconder movimentos" : `ver ${movimentos.length} movimentos`}
          </button>
          {showMoves && (
            <ul className="mt-2 flex flex-col gap-1">
              {movimentos.slice(0, 12).map((tx) => (
                <li key={tx.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate lowercase text-fg-muted">
                    {tx.date.split("-").reverse().slice(0, 2).join("/")} · <KeepRs text={tx.description} />
                  </span>
                  <span
                    className="shrink-0 font-medium tabular"
                    style={{ color: tx.type === "investimento" ? "var(--economia)" : "var(--saida)" }}
                  >
                    {tx.type === "investimento" ? "+" : "−"}
                    <Brl value={tx.amount} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function VaultActions({
  vault,
  onEdit,
  onDelete,
  onMove,
}: {
  vault: Vault;
  onEdit: (vault: Vault) => void;
  onDelete?: (vault: Vault) => void;
  onMove: (vault: Vault, kind: "guardar" | "resgatar") => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <IconButton label={`Guardar em ${vault.name}`} onClick={() => onMove(vault, "guardar")} accent>
        <ArrowDownToLine size={15} />
      </IconButton>
      <IconButton label={`Resgatar de ${vault.name}`} onClick={() => onMove(vault, "resgatar")}>
        <ArrowUpFromLine size={15} />
      </IconButton>
      <IconButton label={`Editar ${vault.name}`} onClick={() => onEdit(vault)}>
        <Pencil size={14} />
      </IconButton>
      {onDelete && (
        <IconButton label={`Excluir ${vault.name}`} onClick={() => onDelete(vault)} danger>
          <Trash2 size={14} />
        </IconButton>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  accent,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-full transition-colors ${
        danger
          ? "text-fg-subtle hover:bg-saida-soft hover:text-saida"
          : accent
            ? "text-[var(--economia)] hover:bg-surface-3"
            : "text-fg-subtle hover:bg-surface-3 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Mini({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <dt className="text-[11px] lowercase text-fg-muted">{label}</dt>
      <dd className="font-semibold tabular">{value}</dd>
      {hint && <p className="text-[10px] lowercase text-fg-subtle">{hint}</p>}
    </div>
  );
}

/** Usado pelo FinanceApp para o texto de confirmação de exclusão. */
export function vaultDeleteDescription(balance: VaultBalance | undefined): string {
  if (!balance) return "";
  return `os ${balance.movimentos.length} lançamentos ligados a ele continuam no saldo, só deixam de contar como desse cofre. saldo atual: ${formatCurrency(balance.saldo)}.`;
}
