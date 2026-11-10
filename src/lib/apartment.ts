/**
 * Contas do plano do apartamento: imóvel na planta, entrada parcelada com a
 * construtora e financiamento bancário que começa na assinatura e só vira
 * parcela cheia nas chaves.
 *
 * Funções puras, usadas pelo navegador (gráficos) e pelo servidor (geração dos
 * lançamentos), então a tela e o saldo projetado sempre batem.
 *
 * As fórmulas reproduzem a planilha de análise do contrato:
 *  - valor financiado corrigido pelo INCC do contrato até a assinatura no banco;
 *  - juros de obra = saldo liberado × taxa mensal + seguros, com a liberação
 *    crescendo em linha reta do % já executado até 100% na previsão de entrega;
 *  - depois das chaves, PRICE (parcela fixa) ou SAC (amortização fixa) + seguros.
 *
 * Indo além da planilha, o financiamento é simulado mês a mês sobre o saldo
 * devedor, o que permite a correção pela TR (como no contrato PRICE/TR da
 * Caixa) e amortizações extras reduzindo prazo ou parcela. Com TR zero e sem
 * amortização o resultado é o mesmo das fórmulas fechadas da planilha.
 */

export type AmortizationSystem = "PRICE" | "SAC";

/** O que a amortização extra encurta: o prazo (parcela igual) ou a parcela (prazo igual). */
export type AmortizationMode = "prazo" | "parcela";

export interface Installments {
  /** Valor do boleto hoje. */
  parcela: number;
  quantidade: number;
  /** YYYY-MM-DD. */
  primeiroVencimento: string;
}

export interface Deadline {
  /** YYYY-MM-DD. */
  data: string;
  titulo: string;
  /** O que acontece se perder. */
  consequencia?: string;
}

export interface ContractItem {
  item: string;
  valor: number;
  nota?: string;
}

export interface ApartmentPremises {
  nome: string;
  /** Renda que o banco considera para aprovar (no caso, só o salário). */
  rendaBanco: number;

  aluguel: number;
  /** Lança o aluguel até as chaves junto com o resto. */
  incluirAluguel: boolean;
  diaAluguel: number;

  /** YYYY-MM-DD: base da correção do INCC. */
  dataContrato: string;
  /** YYYY-MM: mês da assinatura do financiamento no banco. */
  assinaturaBanco: string;
  /** YYYY-MM: previsão de entrega/habite-se. */
  previsaoChaves: string;
  /** Meses de atraso da obra (0 a 6 sem multa). */
  atrasoObraMeses: number;

  valorFinanciado: number;
  /** Taxa efetiva ao ano, ex.: 0.0723. */
  taxaAnual: number;
  prazoMeses: number;
  sistema: AmortizationSystem;
  /** Seguros MIP/DFI + taxa de administração, por mês. */
  seguros: number;
  inccMensal: number;
  /**
   * Correção mensal do saldo devedor pela TR depois das chaves, ex.: 0.001.
   * Varia com a Selic; 0,1% ao mês é um chute conservador.
   */
  trMensal: number;
  /** Fração da obra já executada na assinatura (0–1). */
  obraExecutadaNaAssinatura: number;
  diaVencimentoBanco: number;

  condominio: number;
  iptu: number;
  diaCondominio: number;

  /** Quanto amortizar a mais por mês no banco, depois das chaves. */
  amortizacaoExtra: number;
  amortizacaoModo: AmortizationMode;
  /** YYYY-MM: a partir de quando amortizar. Vazio = desde a 1ª parcela. */
  amortizacaoInicio: string;

  construtora: Installments & {
    /** Parcela de tabela, sem correção: o piso para onde a amortização leva. */
    parcelaBase: number;
  };
  despachante: Installments;

  /** Composição do preço, só para exibição. */
  contrato: ContractItem[];
  bonusAdimplencia: number;
  prazos: Deadline[];
}

export const EMPTY_PREMISES: ApartmentPremises = {
  nome: "meu apartamento",
  rendaBanco: 0,
  aluguel: 0,
  incluirAluguel: false,
  diaAluguel: 10,
  dataContrato: "",
  assinaturaBanco: "",
  previsaoChaves: "",
  atrasoObraMeses: 0,
  valorFinanciado: 0,
  taxaAnual: 0,
  prazoMeses: 420,
  sistema: "PRICE",
  seguros: 0,
  inccMensal: 0.005,
  trMensal: 0.001,
  obraExecutadaNaAssinatura: 0.3,
  diaVencimentoBanco: 10,
  condominio: 0,
  iptu: 0,
  diaCondominio: 10,
  amortizacaoExtra: 0,
  amortizacaoModo: "prazo",
  amortizacaoInicio: "",
  construtora: { parcela: 0, parcelaBase: 0, quantidade: 0, primeiroVencimento: "" },
  despachante: { parcela: 0, quantidade: 0, primeiroVencimento: "" },
  contrato: [],
  bonusAdimplencia: 0,
  prazos: [],
};

/* ------------------------------------------------------------------ */
/* Validação                                                           */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(num(value, fallback, min, max));
}

function str(value: unknown, fallback: string, re?: RegExp, maxLength = 200): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, maxLength);
  if (re && trimmed && !re.test(trimmed)) return fallback;
  return trimmed;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function installments(value: unknown, fallback: Installments): Installments {
  const raw = record(value);
  return {
    parcela: num(raw.parcela, fallback.parcela, 0, 1e7),
    quantidade: int(raw.quantidade, fallback.quantidade, 0, 600),
    primeiroVencimento: str(raw.primeiroVencimento, fallback.primeiroVencimento, DATE_RE),
  };
}

/** Aceita qualquer coisa vinda do banco ou do formulário e devolve premissas válidas. */
export function normalizePremises(value: unknown): ApartmentPremises {
  const raw = record(value);
  const d = EMPTY_PREMISES;
  const construtoraRaw = record(raw.construtora);

  return {
    nome: str(raw.nome, d.nome) || d.nome,
    rendaBanco: num(raw.rendaBanco, d.rendaBanco, 0, 1e7),
    aluguel: num(raw.aluguel, d.aluguel, 0, 1e7),
    incluirAluguel: Boolean(raw.incluirAluguel),
    diaAluguel: int(raw.diaAluguel, d.diaAluguel, 1, 31),
    dataContrato: str(raw.dataContrato, d.dataContrato, DATE_RE),
    assinaturaBanco: str(raw.assinaturaBanco, d.assinaturaBanco, MONTH_RE),
    previsaoChaves: str(raw.previsaoChaves, d.previsaoChaves, MONTH_RE),
    atrasoObraMeses: int(raw.atrasoObraMeses, d.atrasoObraMeses, 0, 60),
    valorFinanciado: num(raw.valorFinanciado, d.valorFinanciado, 0, 1e8),
    taxaAnual: num(raw.taxaAnual, d.taxaAnual, 0, 1),
    prazoMeses: int(raw.prazoMeses, d.prazoMeses, 1, 600),
    sistema: raw.sistema === "SAC" ? "SAC" : "PRICE",
    seguros: num(raw.seguros, d.seguros, 0, 1e6),
    inccMensal: num(raw.inccMensal, d.inccMensal, 0, 0.2),
    trMensal: num(raw.trMensal, d.trMensal, 0, 0.05),
    obraExecutadaNaAssinatura: num(raw.obraExecutadaNaAssinatura, d.obraExecutadaNaAssinatura, 0, 1),
    diaVencimentoBanco: int(raw.diaVencimentoBanco, d.diaVencimentoBanco, 1, 31),
    condominio: num(raw.condominio, d.condominio, 0, 1e6),
    iptu: num(raw.iptu, d.iptu, 0, 1e6),
    diaCondominio: int(raw.diaCondominio, d.diaCondominio, 1, 31),
    amortizacaoExtra: num(raw.amortizacaoExtra, d.amortizacaoExtra, 0, 1e7),
    amortizacaoModo: raw.amortizacaoModo === "parcela" ? "parcela" : "prazo",
    amortizacaoInicio: str(raw.amortizacaoInicio, d.amortizacaoInicio, MONTH_RE),
    construtora: {
      ...installments(raw.construtora, d.construtora),
      parcelaBase: num(construtoraRaw.parcelaBase, d.construtora.parcelaBase, 0, 1e7),
    },
    despachante: installments(raw.despachante, d.despachante),
    contrato: (Array.isArray(raw.contrato) ? raw.contrato : []).slice(0, 30).map((item) => {
      const r = record(item);
      return { item: str(r.item, ""), valor: num(r.valor, 0, -1e9, 1e9), nota: str(r.nota, "") || undefined };
    }),
    bonusAdimplencia: num(raw.bonusAdimplencia, d.bonusAdimplencia, 0, 1e8),
    prazos: (Array.isArray(raw.prazos) ? raw.prazos : [])
      .slice(0, 50)
      .map((item) => {
        const r = record(item);
        return {
          data: str(r.data, "", DATE_RE),
          titulo: str(r.titulo, ""),
          consequencia: str(r.consequencia, "") || undefined,
        };
      })
      .filter((p) => p.data && p.titulo)
      .sort((a, b) => (a.data < b.data ? -1 : 1)),
  };
}

/** Sem estas datas e valores não há cronograma para montar. */
export function isPlanComplete(p: ApartmentPremises): boolean {
  return Boolean(p.dataContrato && p.assinaturaBanco && p.previsaoChaves && p.valorFinanciado > 0);
}

/* ------------------------------------------------------------------ */
/* Datas em "índice de mês" (ano × 12 + mês), como na planilha          */
/* ------------------------------------------------------------------ */

function monthIndex(dateOrMonth: string): number {
  const [y, m] = dateOrMonth.split("-").map(Number);
  return y * 12 + (m - 1);
}

function fromMonthIndex(index: number): { year: number; month: number; key: string } {
  const year = Math.floor(index / 12);
  const month = index % 12;
  return { year, month, key: `${year}-${String(month + 1).padStart(2, "0")}` };
}

function dayOf(dateStr: string): number {
  return Number(dateStr.split("-")[2]) || 1;
}

/** Dia válido no mês (dia 31 em abril vira 30). */
function dateInMonth(index: number, day: number): string {
  const { year, month, key } = fromMonthIndex(index);
  const last = new Date(year, month + 1, 0).getDate();
  return `${key}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Financiamento                                                       */
/* ------------------------------------------------------------------ */

export function monthlyRate(annualEffective: number): number {
  return Math.pow(1 + annualEffective, 1 / 12) - 1;
}

/** Parcela PRICE (sem seguros). */
export function priceInstallment(principal: number, rate: number, months: number): number {
  if (months <= 0) return 0;
  if (rate === 0) return principal / months;
  return (principal * rate) / (1 - Math.pow(1 + rate, -months));
}

/** Parcela SAC número `k` (1 = primeira), sem seguros. */
export function sacInstallment(principal: number, rate: number, months: number, k: number): number {
  const amortizacao = principal / months;
  return amortizacao + (principal - amortizacao * (k - 1)) * rate;
}


/* ------------------------------------------------------------------ */
/* Simulação do financiamento                                          */
/* ------------------------------------------------------------------ */

/** Uma parcela do banco depois das chaves (valores sem seguros). */
export interface LoanInstallment {
  /** Número da parcela, 1-based. */
  n: number;
  /** Índice do mês (ano × 12 + mês). */
  index: number;
  parcela: number;
  juros: number;
  amortizacao: number;
  /** Amortização extra paga no mês, além da parcela. */
  extra: number;
  /** Saldo devedor depois do pagamento. */
  saldo: number;
}

export interface LoanOptions {
  sistema?: AmortizationSystem;
  trMensal?: number;
  amortizacaoExtra?: number;
  amortizacaoModo?: AmortizationMode;
}

/** Trava de segurança: TR alta sem amortizar poderia empurrar o fim além do prazo. */
const MAX_EXTRA_MONTHS = 120;

/**
 * Financiamento mês a mês, das chaves até quitar.
 *
 * Todo mês o saldo é corrigido pela TR antes dos juros, e a parcela é refeita
 * pelo prazo que falta, como a Caixa faz no PRICE/TR. A amortização extra sai
 * depois da parcela; no modo "prazo" o prazo restante é recalculado para manter
 * a parcela, no modo "parcela" o prazo fica e a parcela seguinte cai.
 */
export function simulateLoan(p: ApartmentPremises, options: LoanOptions = {}): LoanInstallment[] {
  if (!isPlanComplete(p)) return [];

  const sistema = options.sistema ?? p.sistema;
  const tr = options.trMensal ?? p.trMensal;
  const extraValor = options.amortizacaoExtra ?? p.amortizacaoExtra;
  const modo = options.amortizacaoModo ?? p.amortizacaoModo;
  const { principal, taxaMensal: i, chavesIndex } = financingBase(p);
  const inicioExtra = p.amortizacaoInicio ? monthIndex(p.amortizacaoInicio) : chavesIndex;

  const out: LoanInstallment[] = [];
  let saldo = principal;
  /** Prazo restante; fracionário depois de amortizar no modo "prazo". */
  let restante = p.prazoMeses;
  /** Amortização fixa do SAC, corrigida pela TR junto com o saldo. */
  let amortizacaoSac = principal / p.prazoMeses;

  for (let n = 1; saldo > 0.005 && n <= p.prazoMeses + MAX_EXTRA_MONTHS; n++) {
    const index = chavesIndex + n - 1;
    saldo *= 1 + tr;
    amortizacaoSac *= 1 + tr;
    const juros = saldo * i;

    let amortizacao: number;
    if (restante <= 1 + 1e-9) {
      amortizacao = saldo;
    } else if (sistema === "SAC") {
      // "prazo": a amortização fica e a dívida acaba antes; "parcela": o prazo fica.
      amortizacao = modo === "prazo" ? amortizacaoSac : saldo / restante;
    } else {
      amortizacao = priceInstallment(saldo, i, restante) - juros;
    }
    amortizacao = Math.min(amortizacao, saldo);
    saldo -= amortizacao;
    restante -= 1;

    let extra = 0;
    if (extraValor > 0 && index >= inicioExtra && saldo > 0) {
      extra = Math.min(extraValor, saldo);
      saldo -= extra;
      if (modo === "prazo" && sistema === "PRICE" && saldo > 0.005) {
        // Prazo que mantém a parcela deste mês: inverte a fórmula da PRICE.
        const parcela = juros + amortizacao;
        const ratio = 1 - (saldo * i) / parcela;
        if (ratio > 0) restante = -Math.log(ratio) / Math.log(1 + i);
      }
    }

    out.push({ n, index, parcela: juros + amortizacao, juros, amortizacao, extra, saldo: Math.max(saldo, 0) });
  }
  return out;
}

interface FinancingBase {
  /** Valor financiado corrigido pelo INCC até a assinatura. */
  principal: number;
  taxaMensal: number;
  /** Índice do mês das chaves já com o atraso. */
  chavesIndex: number;
}

function financingBase(p: ApartmentPremises): FinancingBase {
  const meses = monthIndex(p.assinaturaBanco) - monthIndex(p.dataContrato);
  return {
    principal: p.valorFinanciado * Math.pow(1 + p.inccMensal, Math.max(meses, 0)),
    taxaMensal: monthlyRate(p.taxaAnual),
    chavesIndex: monthIndex(p.previsaoChaves) + p.atrasoObraMeses,
  };
}

export interface LoanSummary {
  /** YYYY-MM da última parcela. */
  fim: string;
  meses: number;
  /** Primeira parcela, com seguros. */
  primeiraParcela: number;
  /** Última parcela cheia (antes do resíduo final), com seguros. */
  ultimaParcela: number;
  juros: number;
  /** Parcelas + amortizações extras + seguros. */
  totalPago: number;
  totalExtra: number;
}

export function summarizeLoan(p: ApartmentPremises, loan: LoanInstallment[]): LoanSummary | null {
  if (loan.length === 0) return null;
  const last = loan[loan.length - 1];
  const penultima = loan.length > 1 ? loan[loan.length - 2] : last;
  let juros = 0;
  let totalPago = 0;
  let totalExtra = 0;
  for (const m of loan) {
    juros += m.juros;
    totalExtra += m.extra;
    totalPago += m.parcela + m.extra + p.seguros;
  }
  return {
    fim: fromMonthIndex(last.index).key,
    meses: loan.length,
    primeiraParcela: loan[0].parcela + p.seguros,
    ultimaParcela: penultima.parcela + p.seguros,
    juros,
    totalPago,
    totalExtra,
  };
}

export interface FinancingFigures extends FinancingBase, LoanSummary {}

export function financingFigures(p: ApartmentPremises): FinancingFigures | null {
  const summary = summarizeLoan(p, simulateLoan(p));
  return summary ? { ...financingBase(p), ...summary } : null;
}

/** "2063-10" -> "out/2063" */
export function monthKeyLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[m - 1]}/${y}`;
}

/* ------------------------------------------------------------------ */
/* Cronograma mês a mês                                                */
/* ------------------------------------------------------------------ */

export type Phase = "antes do banco" | "obra" | "pós-chaves" | "quitado";

export const COMPONENTS = [
  { key: "aluguel", label: "aluguel" },
  { key: "construtora", label: "construtora" },
  { key: "despachante", label: "despachante/itbi" },
  { key: "jurosObra", label: "juros de obra" },
  { key: "banco", label: "parcela do banco" },
  { key: "amortizacao", label: "amortização extra" },
  { key: "condominio", label: "condomínio + iptu" },
] as const;

export type ComponentKey = (typeof COMPONENTS)[number]["key"];

export interface ScheduleMonth {
  index: number;
  key: string;
  year: number;
  month: number;
  fase: Phase;
  aluguel: number;
  construtora: number;
  /** Número da parcela da construtora neste mês (1-based), se houver. */
  construtoraN?: number;
  despachante: number;
  despachanteN?: number;
  jurosObra: number;
  /** Parcela do banco com seguros. */
  banco: number;
  /** Número da parcela do banco (1-based), se houver. */
  bancoN?: number;
  /** Amortização extra do mês. */
  amortizacao: number;
  /** Saldo devedor no banco ao fim do mês (0 antes das chaves). */
  saldoDevedor: number;
  condominio: number;
  /** Tudo com moradia, aluguel e amortização incluídos. */
  total: number;
  /** Só o que é do apê. */
  apenasApe: number;
  /** total / renda do banco (0 se a renda não foi informada). */
  pctRenda: number;
}

/**
 * Cronograma de `from` até `to` (YYYY-MM, inclusive). O aluguel entra no total
 * sempre que informado, mesmo com `incluirAluguel` desligado — essa opção só
 * decide se ele vira lançamento.
 */
export function buildSchedule(
  p: ApartmentPremises,
  from: string,
  to: string,
  loan: LoanInstallment[] = simulateLoan(p),
): ScheduleMonth[] {
  if (!isPlanComplete(p)) return [];

  const { principal, taxaMensal, chavesIndex } = financingBase(p);
  const assinatura = monthIndex(p.assinaturaBanco);
  const previsao = monthIndex(p.previsaoChaves);
  const byIndex = new Map(loan.map((m) => [m.index, m]));
  const quitacao = loan.length > 0 ? loan[loan.length - 1].index : Infinity;

  const c = p.construtora;
  const cStart = c.primeiroVencimento ? monthIndex(c.primeiroVencimento) : Infinity;
  const dsp = p.despachante;
  const dStart = dsp.primeiroVencimento ? monthIndex(dsp.primeiroVencimento) : Infinity;

  const result: ScheduleMonth[] = [];
  for (let i = monthIndex(from); i <= monthIndex(to); i++) {
    const { year, month, key } = fromMonthIndex(i);
    const antesChaves = i < chavesIndex;
    const fase: Phase =
      i < assinatura ? "antes do banco" : antesChaves ? "obra" : i <= quitacao ? "pós-chaves" : "quitado";

    const aluguel = antesChaves ? p.aluguel : 0;

    const construtoraN = i >= cStart && i < cStart + c.quantidade ? i - cStart + 1 : undefined;
    const construtora = construtoraN ? c.parcela : 0;

    const despachanteN = i >= dStart && i < dStart + dsp.quantidade ? i - dStart + 1 : undefined;
    const despachante = despachanteN ? dsp.parcela : 0;

    let jurosObra = 0;
    if (i > assinatura && antesChaves) {
      const liberado = Math.min(
        1,
        p.obraExecutadaNaAssinatura +
          ((1 - p.obraExecutadaNaAssinatura) * (i - assinatura)) / Math.max(1, previsao - assinatura),
      );
      jurosObra = principal * liberado * taxaMensal + p.seguros;
    }

    const parcela = byIndex.get(i);
    const banco = parcela ? parcela.parcela + p.seguros : 0;
    const amortizacao = parcela?.extra ?? 0;

    const condominio = antesChaves ? 0 : p.condominio + p.iptu;
    const apenasApe = construtora + despachante + jurosObra + banco + amortizacao + condominio;
    const total = apenasApe + aluguel;

    result.push({
      index: i,
      key,
      year,
      month,
      fase,
      aluguel,
      construtora,
      construtoraN,
      despachante,
      despachanteN,
      jurosObra,
      banco,
      bancoN: parcela?.n,
      amortizacao,
      saldoDevedor: parcela?.saldo ?? 0,
      condominio,
      total,
      apenasApe,
      pctRenda: p.rendaBanco > 0 ? total / p.rendaBanco : 0,
    });
  }
  return result;
}

/** Do mês do contrato até a última parcela do banco. */
export function scheduleRange(p: ApartmentPremises, loan: LoanInstallment[] = simulateLoan(p)): { from: string; to: string } {
  const start = monthIndex(p.dataContrato);
  const { chavesIndex } = financingBase(p);
  const cEnd = p.construtora.primeiroVencimento
    ? monthIndex(p.construtora.primeiroVencimento) + p.construtora.quantidade - 1
    : 0;
  const end = Math.max(loan.length > 0 ? loan[loan.length - 1].index : chavesIndex, cEnd);
  return { from: fromMonthIndex(start).key, to: fromMonthIndex(end).key };
}

/** Onde o gráfico mês a mês termina: um ano depois da última parcela da construtora. */
export function detailedRangeEnd(p: ApartmentPremises): string {
  const { chavesIndex } = financingBase(p);
  const cEnd = p.construtora.primeiroVencimento
    ? monthIndex(p.construtora.primeiroVencimento) + p.construtora.quantidade - 1
    : 0;
  return fromMonthIndex(Math.max(chavesIndex + 12, cEnd + 12)).key;
}

/* ------------------------------------------------------------------ */
/* Lançamentos gerados                                                 */
/* ------------------------------------------------------------------ */

export const SOURCE_PREFIX = "apto:";

export interface GeneratedTransaction {
  /** YYYY-MM-DD. */
  date: string;
  description: string;
  amount: number;
  source: `${typeof SOURCE_PREFIX}${ComponentKey}`;
}

/**
 * Saídas do plano de `fromDate` (inclusive) até a quitação. Lançamentos com
 * data anterior ficam de fora: o passado é o que de fato aconteceu. O
 * condomínio segue até o mesmo mês, porque depois disso o saldo nem é projetado.
 */
export function generateTransactions(p: ApartmentPremises, fromDate: string): GeneratedTransaction[] {
  const loan = simulateLoan(p);
  const { to } = scheduleRange(p, loan);
  const startIndex = monthIndex(fromDate);
  if (startIndex > monthIndex(to)) return [];
  const schedule = buildSchedule(p, fromMonthIndex(startIndex).key, to, loan);
  const out: GeneratedTransaction[] = [];
  const totalParcelas = loan.length;

  const push = (index: number, day: number, description: string, amount: number, key: ComponentKey) => {
    if (amount <= 0) return;
    const date = dateInMonth(index, day);
    if (date < fromDate) return;
    out.push({ date, description, amount: Math.round(amount * 100) / 100, source: `${SOURCE_PREFIX}${key}` });
  };

  for (const m of schedule) {
    if (p.incluirAluguel) push(m.index, p.diaAluguel, "aluguel", m.aluguel, "aluguel");
    if (m.construtoraN) {
      push(
        m.index,
        dayOf(p.construtora.primeiroVencimento),
        `apê · construtora (${m.construtoraN}/${p.construtora.quantidade})`,
        m.construtora,
        "construtora",
      );
    }
    if (m.despachanteN) {
      push(
        m.index,
        dayOf(p.despachante.primeiroVencimento),
        `apê · despachante/itbi (${m.despachanteN}/${p.despachante.quantidade})`,
        m.despachante,
        "despachante",
      );
    }
    push(m.index, p.diaVencimentoBanco, "apê · juros de obra (estimado)", m.jurosObra, "jurosObra");
    if (m.bancoN) {
      push(m.index, p.diaVencimentoBanco, `apê · caixa (${m.bancoN}/${totalParcelas})`, m.banco, "banco");
    }
    push(m.index, p.diaVencimentoBanco, "apê · amortização extra", m.amortizacao, "amortizacao");
    push(m.index, p.diaCondominio, "apê · condomínio + iptu", m.condominio, "condominio");
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Resumos                                                             */
/* ------------------------------------------------------------------ */

export interface YearAverage {
  year: number;
  media: number;
  mediaApe: number;
  pctRenda: number;
  fases: Phase[];
  /** Saldo devedor no fim do ano. */
  saldoDevedor: number;
}

export function yearlyAverages(schedule: ScheduleMonth[]): YearAverage[] {
  const byYear = new Map<number, ScheduleMonth[]>();
  for (const m of schedule) {
    const bucket = byYear.get(m.year);
    if (bucket) bucket.push(m);
    else byYear.set(m.year, [m]);
  }
  return [...byYear.entries()].map(([year, months]) => {
    const media = months.reduce((s, m) => s + m.total, 0) / months.length;
    return {
      year,
      media,
      mediaApe: months.reduce((s, m) => s + m.apenasApe, 0) / months.length,
      pctRenda: months.reduce((s, m) => s + m.pctRenda, 0) / months.length,
      fases: [...new Set(months.map((m) => m.fase))],
      saldoDevedor: months[months.length - 1].saldoDevedor,
    };
  });
}

/** Resultado de quitar com uma amortização extra mensal, comparado a não amortizar. */
export interface AmortizationResult {
  extra: number;
  modo: AmortizationMode;
  summary: LoanSummary;
  /** Meses a menos que sem amortizar. */
  mesesEconomizados: number;
  jurosEconomizados: number;
}

export function simulateAmortization(
  p: ApartmentPremises,
  extra: number,
  modo: AmortizationMode,
): AmortizationResult | null {
  const base = summarizeLoan(p, simulateLoan(p, { amortizacaoExtra: 0 }));
  const sim = summarizeLoan(p, simulateLoan(p, { amortizacaoExtra: extra, amortizacaoModo: modo }));
  if (!base || !sim) return null;
  return {
    extra,
    modo,
    summary: sim,
    mesesEconomizados: base.meses - sim.meses,
    jurosEconomizados: base.juros - sim.juros,
  };
}

export interface Scenario {
  titulo: string;
  impacto: number;
  explicacao: string;
}

/** Os "e se der ruim?" da planilha, recalculados com as premissas atuais. */
export function scenarios(p: ApartmentPremises): Scenario[] {
  const { principal, taxaMensal } = financingBase(p);
  const semExtra = { amortizacaoExtra: 0 };
  const price = summarizeLoan(p, simulateLoan(p, { ...semExtra, sistema: "PRICE" }));
  const sac = summarizeLoan(p, simulateLoan(p, { ...semExtra, sistema: "SAC" }));
  const semTr = summarizeLoan(p, simulateLoan(p, { ...semExtra, trMensal: 0 }));
  const comTr = summarizeLoan(p, simulateLoan(p, semExtra));

  const list: Scenario[] = [
    {
      titulo: "obra atrasa 6 meses",
      impacto: 6 * (p.aluguel + principal * taxaMensal + p.seguros),
      explicacao: "6 meses a mais de aluguel e de juros de obra cheios. a construtora pode atrasar 180 dias sem multa.",
    },
  ];

  if (price && sac) {
    list.push(
      {
        titulo: "price × sac na 1ª parcela",
        impacto: sac.primeiraParcela - price.primeiraParcela,
        explicacao: "quanto a sac começa mais cara. ela cai todo mês; a price fica quase fixa (só sobe com a tr).",
      },
      {
        titulo: "price × sac no total de juros",
        impacto: price.juros - sac.juros,
        explicacao: "quanto a price custa a mais em juros no prazo inteiro, sem amortizar nada.",
      },
    );
  }

  if (semTr && comTr && p.trMensal > 0) {
    list.push({
      titulo: "o que a tr custa",
      impacto: comTr.totalPago - semTr.totalPago,
      explicacao: `diferença no total pago com a tr em ${(p.trMensal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}% ao mês contra tr zero. a tr corrige o saldo e a parcela todo mês.`,
    });
  }

  if (p.bonusAdimplencia > 0) {
    list.unshift({
      titulo: "atrasar uma parcela da construtora",
      impacto: p.bonusAdimplencia,
      explicacao: "perde o bônus de adimplência, que vira dívida com encargos.",
    });
  }

  if (p.construtora.parcelaBase > 0 && p.construtora.parcela > p.construtora.parcelaBase) {
    list.push({
      titulo: "amortizar a construtora",
      impacto: p.construtora.parcela - p.construtora.parcelaBase,
      explicacao: "quanto a parcela da construtora pode cair por mês se a amortização trouxer o boleto de volta ao valor de tabela.",
    });
  }

  return list;
}
