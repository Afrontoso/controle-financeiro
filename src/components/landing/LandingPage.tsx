"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bug,
  CalendarDays,
  Github,
  LayoutGrid,
  Mail,
  Moon,
  Repeat,
  Sun,
  Target,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrency, heatTone } from "@/lib/format";
import { TypeBadge } from "@/components/ui/TypeBadge";
import type { TxType } from "@/lib/types";

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-[100dvh] bg-bg text-fg">
      <header className="sticky top-0 z-50 border-b border-border-base bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <span className="flex items-center gap-2.5">
            <span
              className="grid size-9 place-items-center rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
            >
              <Wallet size={18} />
            </span>
            <span className="font-semibold lowercase">controle financeiro</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
              className="grid size-9 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              href="/entrar"
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold lowercase text-brand-fg transition-transform active:scale-95"
            >
              entrar
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-16 md:px-8 md:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium lowercase"
                style={{ background: "var(--diario-soft)", color: "var(--diario)" }}
              >
                <TrendingDown size={14} /> saiba hoje o saldo de daqui a seis meses
              </span>

              <h1 className="mt-5 text-4xl leading-[1.05] font-semibold lowercase tracking-tight md:text-6xl">
                seu dinheiro,
                <br />
                dia a dia,
                <br />
                <span style={{ color: "var(--entrada)" }}>até o fim do ano</span>
              </h1>

              <p className="mt-5 max-w-md text-base text-fg-muted md:text-lg">
                um fluxo de caixa que não para no mês atual. lance o que entra e o que sai,
                cadastre suas contas fixas e veja o saldo projetado de cada dia — inclusive
                o dia em que ele fica negativo.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/entrar"
                  className="flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 font-semibold lowercase text-brand-fg transition-transform active:scale-95"
                >
                  começar agora <ArrowRight size={18} />
                </Link>
                <span className="text-sm text-fg-subtle lowercase">
                  entra com a conta google · sem cadastro
                </span>
              </div>
            </div>

            <HeroTable />
          </div>
        </section>

        <section className="border-y border-border-base bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
            <h2 className="text-2xl font-semibold lowercase tracking-tight md:text-3xl">
              como funciona
            </h2>
            <p className="mt-2 max-w-2xl text-fg-muted">
              três passos. depois disso o saldo futuro se atualiza sozinho a cada lançamento.
            </p>

            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              <Step
                number="1"
                icon={Wallet}
                title="registre o que entra e o que sai"
                text="cada lançamento tem um tipo: entrada, saída, gasto diário, economia ou cartão. o valor cai no dia escolhido e o saldo se refaz dali pra frente."
              />
              <Step
                number="2"
                icon={Target}
                title="cadastre suas contas fixas"
                text="um orçamento de R$ 1.200 dividido por 30 reserva R$ 40 por dia no saldo futuro. é isso que impede a projeção de parecer otimista demais."
              />
              <Step
                number="3"
                icon={CalendarDays}
                title="acompanhe o horizonte"
                text="a tela horizonte mostra vários meses lado a lado, cada dia colorido pela faixa do saldo. o vermelho aparece antes de virar problema."
              />
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
          <h2 className="text-2xl font-semibold lowercase tracking-tight md:text-3xl">
            o que tem dentro
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature
              icon={LayoutGrid}
              title="tabela de saldos"
              text="um mês por bloco, com colunas separadas por tipo e o total de cada coluna no rodapé."
            />
            <Feature
              icon={Repeat}
              title="lançamentos recorrentes"
              text="repita por dia, semana ou mês, com prazo definido ou indeterminado. editar ou apagar pergunta se vale para todas as parcelas."
            />
            <Feature
              icon={TrendingDown}
              title="totais do mês"
              text="performance, custo de vida, quanto do orçamento já foi usado e a projeção de fechamento no ritmo atual."
            />
            <Feature
              icon={Moon}
              title="claro e escuro"
              text="o tema acompanha o sistema e pode ser trocado a qualquer momento. funciona igual no celular e no computador."
            />
          </div>
        </section>

        <section className="border-t border-border-base bg-surface">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center md:px-8">
            <h2 className="text-3xl font-semibold lowercase tracking-tight md:text-4xl">
              pare de descobrir o vermelho no extrato
            </h2>
            <p className="mt-4 max-w-lg text-fg-muted">
              leva alguns minutos para cadastrar as contas fixas. depois é só lançar o que
              acontece — a projeção se encarrega do resto.
            </p>
            <Link
              href="/entrar"
              className="mt-8 flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 font-semibold lowercase text-brand-fg transition-transform active:scale-95"
            >
              entrar com o google <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-base">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-fg-subtle md:px-8">
          <span className="lowercase">
            feito por <span className="font-medium text-fg-muted">victor assis</span>
          </span>
          <div className="flex items-center gap-4">
            <a href="mailto:victor2lra@gmail.com" title="E-mail" className="hover:text-fg">
              <Mail size={17} />
            </a>
            <a
              href="https://github.com/Afrontoso"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="hover:text-fg"
            >
              <Github size={17} />
            </a>
            <a
              href="mailto:victor2lra@gmail.com?subject=Bug%20no%20controle%20financeiro"
              className="flex items-center gap-1.5 rounded-full border border-border-base px-3 py-1.5 text-xs lowercase transition-colors hover:text-fg"
            >
              <Bug size={13} /> reportar bug
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface PreviewDay {
  day: number;
  type: TxType | null;
  value: number;
  saldo: number;
}

/** Amostra da tela de saldos, montada com os mesmos tokens do app. */
const PREVIEW_DAYS: PreviewDay[] = [
  { day: 5, type: "entrada", value: 5932.84, saldo: 5062.44 },
  { day: 9, type: "saida", value: 200, saldo: 4807.44 },
  { day: 10, type: "saida", value: 995, saldo: 3757.44 },
  { day: 12, type: "cartao", value: 556, saldo: 2921.54 },
  { day: 15, type: "saida", value: 100, saldo: 2656.54 },
  { day: 20, type: "cartao", value: 1443, saldo: 768.5 },
  { day: 24, type: null, value: 0, saldo: 548.5 },
  { day: 28, type: null, value: 0, saldo: -42.5 },
  { day: 31, type: null, value: 0, saldo: -870.4 },
];

function HeroTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-base bg-surface shadow-e3">
      <div className="border-b border-border-base px-5 py-4">
        <p className="text-base font-semibold lowercase">agosto</p>
      </div>

      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-12" />
          <col />
          <col className="w-32" />
        </colgroup>
        <thead>
          <tr className="bg-surface-2 text-[11px] font-medium lowercase text-fg-muted">
            <th className="border-b border-border-base px-2 py-2.5 text-center font-medium">
              dia
            </th>
            <th className="border-b border-border-base px-3 py-2.5 text-left font-medium">
              lançamento
            </th>
            <th className="border-b border-border-base px-3 py-2.5 text-right font-medium">
              saldos
            </th>
          </tr>
        </thead>
        <tbody>
          {PREVIEW_DAYS.map((row) => {
            const tone = heatTone(row.saldo);
            return (
              <tr key={row.day} className="border-b border-border-base/60 last:border-0">
                <td className="px-2 py-2 text-center text-[13px] tabular text-fg-muted">
                  {row.day}
                </td>
                <td className="px-3 py-2">
                  {row.type ? (
                    <span className="flex items-center gap-2">
                      <TypeBadge type={row.type} size={16} />
                      <span className="text-[13px] font-medium tabular">
                        {formatCurrency(row.value)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] tabular text-fg-subtle/60">—</span>
                  )}
                </td>
                <td className="p-0">
                  <span
                    className="flex h-9 items-center justify-end px-3 text-[13px] font-semibold tabular"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {formatCurrency(row.saldo)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Step({
  number,
  icon: Icon,
  title,
  text,
}: {
  number: string;
  icon: typeof Wallet;
  title: string;
  text: string;
}) {
  return (
    <li className="rounded-2xl border border-border-base bg-surface-2 p-6">
      <span className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-brand-fg">
          {number}
        </span>
        <Icon size={20} className="text-fg-subtle" />
      </span>
      <h3 className="mt-4 font-semibold lowercase">{title}</h3>
      <p className="mt-2 text-sm text-fg-muted">{text}</p>
    </li>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Wallet;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border-base bg-surface p-5">
      <Icon size={20} className="text-fg-subtle" />
      <h3 className="mt-3 font-semibold lowercase">{title}</h3>
      <p className="mt-1.5 text-sm text-fg-muted">{text}</p>
    </div>
  );
}
