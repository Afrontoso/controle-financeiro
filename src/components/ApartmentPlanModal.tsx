"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";
import { normalizePremises, type ApartmentPremises, type Deadline } from "@/lib/apartment";

interface ApartmentPlanModalProps {
  initial: ApartmentPremises;
  busy?: boolean;
  onClose: () => void;
  onSave: (premises: ApartmentPremises) => void;
}

const inputClass =
  // Altura fixa: campos de data e mês têm altura própria em alguns navegadores.
  "h-11 w-full rounded-xl border border-border-base bg-surface-2 px-3 text-sm tabular outline-none placeholder:text-fg-subtle focus:border-border-strong";

export function ApartmentPlanModal({ initial, busy, onClose, onSave }: ApartmentPlanModalProps) {
  const [p, setP] = useState<ApartmentPremises>(initial);

  const set = <K extends keyof ApartmentPremises>(key: K, value: ApartmentPremises[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const setPrazo = (index: number, patch: Partial<Deadline>) =>
    setP((prev) => ({
      ...prev,
      prazos: prev.prazos.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }));

  return (
    <Modal onClose={busy ? () => {} : onClose} title="premissas do apartamento" size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(normalizePremises(p));
        }}
        className="flex min-h-0 flex-col"
      >
        <div className="scrollbar-thin flex max-h-[70dvh] min-h-0 flex-col gap-6 overflow-y-auto px-6 pb-2">
          <Group title="geral">
            <Field label="nome" wide>
              <input className={inputClass} value={p.nome} onChange={(e) => set("nome", e.target.value)} />
            </Field>
            <Field label="renda para o banco" hint="só o que entra na aprovação">
              <MoneyInput value={p.rendaBanco} onChange={(v) => set("rendaBanco", v)} />
            </Field>
            <Field label="data do contrato" hint="base da correção pelo incc">
              <input type="date" className={inputClass} value={p.dataContrato} onChange={(e) => set("dataContrato", e.target.value)} />
            </Field>
          </Group>

          <Group title="aluguel até as chaves">
            <Field label="aluguel">
              <MoneyInput value={p.aluguel} onChange={(v) => set("aluguel", v)} />
            </Field>
            <Field label="dia do aluguel">
              <DayInput value={p.diaAluguel} onChange={(v) => set("diaAluguel", v)} />
            </Field>
            <label className="col-span-full flex items-center gap-2.5 text-sm lowercase">
              <input
                type="checkbox"
                checked={p.incluirAluguel}
                onChange={(e) => set("incluirAluguel", e.target.checked)}
                className="size-4 accent-[var(--entrada)]"
              />
              gerar o aluguel como lançamento
              <span className="text-xs text-fg-subtle">(desligue se ele já está lançado à mão)</span>
            </label>
          </Group>

          <Group title="construtora">
            <Field label="parcela atual (boleto)">
              <MoneyInput value={p.construtora.parcela} onChange={(v) => set("construtora", { ...p.construtora, parcela: v })} />
            </Field>
            <Field label="parcela de tabela" hint="para onde a amortização leva">
              <MoneyInput value={p.construtora.parcelaBase} onChange={(v) => set("construtora", { ...p.construtora, parcelaBase: v })} />
            </Field>
            <Field label="quantidade de parcelas">
              <NumberInput value={p.construtora.quantidade} onChange={(v) => set("construtora", { ...p.construtora, quantidade: v })} />
            </Field>
            <Field label="1º vencimento">
              <input type="date" className={inputClass} value={p.construtora.primeiroVencimento} onChange={(e) => set("construtora", { ...p.construtora, primeiroVencimento: e.target.value })} />
            </Field>
            <Field label="bônus de adimplência" hint="desconto que se perde com atraso">
              <MoneyInput value={p.bonusAdimplencia} onChange={(v) => set("bonusAdimplencia", v)} />
            </Field>
          </Group>

          <Group title="despachante / itbi / registro">
            <Field label="parcela">
              <MoneyInput value={p.despachante.parcela} onChange={(v) => set("despachante", { ...p.despachante, parcela: v })} />
            </Field>
            <Field label="quantidade de parcelas">
              <NumberInput value={p.despachante.quantidade} onChange={(v) => set("despachante", { ...p.despachante, quantidade: v })} />
            </Field>
            <Field label="1º vencimento">
              <input type="date" className={inputClass} value={p.despachante.primeiroVencimento} onChange={(e) => set("despachante", { ...p.despachante, primeiroVencimento: e.target.value })} />
            </Field>
          </Group>

          <Group title="financiamento no banco">
            <Field label="valor financiado" hint="o da simulação">
              <MoneyInput value={p.valorFinanciado} onChange={(v) => set("valorFinanciado", v)} />
            </Field>
            <Field label="juros ao ano (efetivo)" hint="ex.: 7,23">
              <PercentInput value={p.taxaAnual} onChange={(v) => set("taxaAnual", v)} />
            </Field>
            <Field label="prazo (meses)">
              <NumberInput value={p.prazoMeses} onChange={(v) => set("prazoMeses", v)} />
            </Field>
            <Field label="sistema">
              <div className="flex h-11 gap-1 rounded-xl bg-surface-3 p-1">
                {(["PRICE", "SAC"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("sistema", s)}
                    className={`flex-1 rounded-lg text-sm font-medium transition-colors ${
                      p.sistema === s ? "bg-surface shadow-sm" : "text-fg-muted"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="seguros + taxa (mês)" hint="mip, dfi e administração">
              <MoneyInput value={p.seguros} onChange={(v) => set("seguros", v)} />
            </Field>
            <Field label="dia do vencimento">
              <DayInput value={p.diaVencimentoBanco} onChange={(v) => set("diaVencimentoBanco", v)} />
            </Field>
            <Field label="assinatura no banco">
              <input type="month" className={inputClass} value={p.assinaturaBanco} onChange={(e) => set("assinaturaBanco", e.target.value)} />
            </Field>
            <Field label="incc ao mês" hint="ex.: 0,5">
              <PercentInput value={p.inccMensal} onChange={(v) => set("inccMensal", v)} />
            </Field>
            <Field label="tr ao mês" hint="corrige saldo e parcela. ex.: 0,1">
              <PercentInput value={p.trMensal} onChange={(v) => set("trMensal", v)} />
            </Field>
            <Field label="obra pronta na assinatura" hint="chute; ajuste depois">
              <PercentInput value={p.obraExecutadaNaAssinatura} onChange={(v) => set("obraExecutadaNaAssinatura", v)} />
            </Field>
          </Group>

          <Group title="chaves e depois">
            <Field label="previsão de entrega">
              <input type="month" className={inputClass} value={p.previsaoChaves} onChange={(e) => set("previsaoChaves", e.target.value)} />
            </Field>
            <Field label="atraso da obra (meses)" hint="0 a 6 sem multa">
              <NumberInput value={p.atrasoObraMeses} onChange={(v) => set("atrasoObraMeses", v)} />
            </Field>
            <Field label="condomínio">
              <MoneyInput value={p.condominio} onChange={(v) => set("condominio", v)} />
            </Field>
            <Field label="iptu / tlp (mês)">
              <MoneyInput value={p.iptu} onChange={(v) => set("iptu", v)} />
            </Field>
            <Field label="dia do condomínio">
              <DayInput value={p.diaCondominio} onChange={(v) => set("diaCondominio", v)} />
            </Field>
          </Group>

          <Group title="amortização extra no banco">
            <Field label="valor por mês" hint="0 = não amortizar">
              <MoneyInput value={p.amortizacaoExtra} onChange={(v) => set("amortizacaoExtra", v)} />
            </Field>
            <Field label="o que reduzir">
              <div className="flex h-11 gap-1 rounded-xl bg-surface-3 p-1">
                {(["prazo", "parcela"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set("amortizacaoModo", m)}
                    className={`flex-1 rounded-lg text-sm font-medium lowercase transition-colors ${
                      p.amortizacaoModo === m ? "bg-surface shadow-sm" : "text-fg-muted"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="a partir de" hint="vazio = desde as chaves">
              <input type="month" className={inputClass} value={p.amortizacaoInicio} onChange={(e) => set("amortizacaoInicio", e.target.value)} />
            </Field>
          </Group>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold lowercase">prazos importantes</h3>
              <button
                type="button"
                onClick={() => set("prazos", [...p.prazos, { data: "", titulo: "" }])}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs lowercase text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <Plus size={14} /> prazo
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {p.prazos.map((d, i) => (
                <div key={i} className="grid grid-cols-[8.5rem_1fr_auto] items-start gap-2">
                  <input type="date" className={inputClass} value={d.data} onChange={(e) => setPrazo(i, { data: e.target.value })} />
                  <div className="flex flex-col gap-1.5">
                    <input className={inputClass} placeholder="o quê" value={d.titulo} onChange={(e) => setPrazo(i, { titulo: e.target.value })} />
                    <input className={inputClass} placeholder="se perder… (opcional)" value={d.consequencia ?? ""} onChange={(e) => setPrazo(i, { consequencia: e.target.value })} />
                  </div>
                  <button
                    type="button"
                    onClick={() => set("prazos", p.prazos.filter((_, j) => j !== i))}
                    aria-label="Remover prazo"
                    className="grid size-9 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-saida-soft hover:text-saida"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {p.prazos.length === 0 && (
                <p className="text-xs lowercase text-fg-subtle">nenhum prazo cadastrado.</p>
              )}
            </div>
          </section>
        </div>

        <div className="shrink-0 p-6 pt-4">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brand py-3.5 text-base font-semibold lowercase text-brand-fg transition-opacity active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "salvando..." : "salvar premissas"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold lowercase">{title}</h3>
      <div className="grid grid-cols-1 items-start gap-x-3 gap-y-4 sm:grid-cols-2 md:grid-cols-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    // Nome numa linha só e a dica embaixo da caixa: assim as caixas da mesma
    // linha ficam alinhadas, tenha a dica o tamanho que tiver.
    <label className={`flex min-w-0 flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="truncate text-xs lowercase text-fg-muted" title={label}>
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] leading-snug lowercase text-fg-subtle">{hint}</span>}
    </label>
  );
}

/** Igual ao valor do lançamento: digita só números, os dois últimos são centavos. */
function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      inputMode="numeric"
      className={inputClass}
      placeholder="0,00"
      value={value > 0 ? formatCurrency(value).replace("R$", "").trim() : ""}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 12) || "0") / 100)}
    />
  );
}

/** Mostra e aceita "7,23" (por cento) e guarda 0.0723. */
function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(() =>
    value ? (value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "",
  );
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        className={`${inputClass} pr-8`}
        placeholder="0"
        value={text}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d,.]/g, "");
          setText(cleaned);
          const n = Number(cleaned.replace(/\./g, "").replace(",", "."));
          if (Number.isFinite(n)) onChange(n / 100);
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-fg-subtle">%</span>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      inputMode="numeric"
      className={inputClass}
      value={value ? String(value) : ""}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 4) || "0"))}
    />
  );
}

function DayInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      inputMode="numeric"
      className={inputClass}
      value={value ? String(value) : ""}
      placeholder="10"
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, "").slice(0, 2) || "0");
        onChange(Math.min(n, 31));
      }}
    />
  );
}
