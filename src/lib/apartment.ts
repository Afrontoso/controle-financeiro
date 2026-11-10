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
 */

export type AmortizationSystem = "PRICE" | "SAC";

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
  /** Fração da obra já executada na assinatura (0–1). */
  obraExecutadaNaAssinatura: number;
  diaVencimentoBanco: number;

  condominio: number;
  iptu: number;
  diaCondominio: number;

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
  obraExecutadaNaAssinatura: 0.3,
  diaVencimentoBanco: 10,
  condominio: 0,
  iptu: 0,
  diaCondominio: 10,
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
    obraExecutadaNaAssinatura: num(raw.obraExecutadaNaAssinatura, d.obraExecutadaNaAssinatura, 0, 1),
    diaVencimentoBanco: int(raw.diaVencimentoBanco, d.diaVencimentoBanco, 1, 31),
    condominio: num(raw.condominio, d.condominio, 0, 1e6),
    iptu: num(raw.iptu, d.iptu, 0, 1e6),
    diaCondominio: int(raw.diaCondominio, d.diaCondominio, 1, 31),
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

export interface FinancingFigures {
  /** Valor financiado corrigido pelo INCC até a assinatura. */
  principal: number;
  taxaMensal: number;
  /** Índice do mês das chaves já com o atraso. */
  chavesIndex: number;
  /** Primeira parcela do banco depois das chaves, com seguros. */
  primeiraParcela: number;
  /** Total pago ao banco no prazo inteiro, sem seguros. */
  totalBanco: number;
}

export function financingFigures(p: ApartmentPremises): FinancingFigures {
  const meses = monthIndex(p.assinaturaBanco) - monthIndex(p.dataContrato);
  const principal = p.valorFinanciado * Math.pow(1 + p.inccMensal, Math.max(meses, 0));
  const taxaMensal = monthlyRate(p.taxaAnual);
  const chavesIndex = monthIndex(p.previsaoChaves) + p.atrasoObraMeses;

  const primeira =
    p.sistema === "SAC"
      ? sacInstallment(principal, taxaMensal, p.prazoMeses, 1)
      : priceInstallment(principal, taxaMensal, p.prazoMeses);

  let totalBanco = 0;
  if (p.sistema === "SAC") {
    // Soma da progressão aritmética das parcelas SAC.
    totalBanco = principal + principal * taxaMensal * ((p.prazoMeses + 1) / 2);
  } else {
    totalBanco = priceInstallment(principal, taxaMensal, p.prazoMeses) * p.prazoMeses;
  }

  return { principal, taxaMensal, chavesIndex, primeiraParcela: primeira + p.seguros, totalBanco };
}

/* ------------------------------------------------------------------ */
/* Cronograma mês a mês                                                */
/* ------------------------------------------------------------------ */

export type Phase = "antes do banco" | "obra" | "pós-chaves";

export const COMPONENTS = [
  { key: "aluguel", label: "aluguel" },
  { key: "construtora", label: "construtora" },
  { key: "despachante", label: "despachante/itbi" },
  { key: "jurosObra", label: "juros de obra" },
  { key: "banco", label: "parcela do banco" },
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
  banco: number;
  /** Número da parcela do banco (1-based), se houver. */
  bancoN?: number;
  condominio: number;
  /** Tudo com moradia, aluguel incluído. */
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
export function buildSchedule(p: ApartmentPremises, from: string, to: string): ScheduleMonth[] {
  if (!isPlanComplete(p)) return [];

  const { principal, taxaMensal, chavesIndex } = financingFigures(p);
  const assinatura = monthIndex(p.assinaturaBanco);
  const previsao = monthIndex(p.previsaoChaves);
  const price = priceInstallment(principal, taxaMensal, p.prazoMeses);

  const c = p.construtora;
  const cStart = c.primeiroVencimento ? monthIndex(c.primeiroVencimento) : Infinity;
  const dsp = p.despachante;
  const dStart = dsp.primeiroVencimento ? monthIndex(dsp.primeiroVencimento) : Infinity;

  const result: ScheduleMonth[] = [];
  for (let i = monthIndex(from); i <= monthIndex(to); i++) {
    const { year, month, key } = fromMonthIndex(i);
    const antesChaves = i < chavesIndex;
    const fase: Phase = i < assinatura ? "antes do banco" : antesChaves ? "obra" : "pós-chaves";

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

    let banco = 0;
    let bancoN: number | undefined;
    if (!antesChaves && i - chavesIndex < p.prazoMeses) {
      bancoN = i - chavesIndex + 1;
      banco =
        (p.sistema === "SAC" ? sacInstallment(principal, taxaMensal, p.prazoMeses, bancoN) : price) +
        p.seguros;
    }

    const condominio = antesChaves ? 0 : p.condominio + p.iptu;
    const apenasApe = construtora + despachante + jurosObra + banco + condominio;
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
      bancoN,
      condominio,
      total,
      apenasApe,
      pctRenda: p.rendaBanco > 0 ? total / p.rendaBanco : 0,
    });
  }
  return result;
}

/** Do mês do contrato até 2 anos depois da última parcela da construtora (ou das chaves). */
export function scheduleRange(p: ApartmentPremises): { from: string; to: string } {
  const start = monthIndex(p.dataContrato);
  const { chavesIndex } = financingFigures(p);
  const cEnd = p.construtora.primeiroVencimento
    ? monthIndex(p.construtora.primeiroVencimento) + p.construtora.quantidade
    : 0;
  const end = Math.max(chavesIndex + 24, cEnd + 24);
  return { from: fromMonthIndex(start).key, to: fromMonthIndex(end).key };
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

/** Quantos meses à frente os lançamentos são gerados (igual às recorrências sem fim). */
export const GENERATION_HORIZON_MONTHS = 120;

/**
 * Saídas do plano de `fromDate` (inclusive) até o horizonte. Lançamentos com
 * data anterior ficam de fora: o passado é o que de fato aconteceu.
 */
export function generateTransactions(p: ApartmentPremises, fromDate: string): GeneratedTransaction[] {
  const startIndex = monthIndex(fromDate);
  const end = fromMonthIndex(startIndex + GENERATION_HORIZON_MONTHS - 1).key;
  const schedule = buildSchedule(p, fromMonthIndex(startIndex).key, end);
  const out: GeneratedTransaction[] = [];

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
      push(m.index, p.diaVencimentoBanco, `apê · caixa (${m.bancoN}/${p.prazoMeses})`, m.banco, "banco");
    }
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
    };
  });
}

export interface Scenario {
  titulo: string;
  impacto: number;
  explicacao: string;
}

/** Os "e se der ruim?" da planilha, recalculados com as premissas atuais. */
export function scenarios(p: ApartmentPremises): Scenario[] {
  const { principal, taxaMensal } = financingFigures(p);
  const price = priceInstallment(principal, taxaMensal, p.prazoMeses);
  const sac1 = sacInstallment(principal, taxaMensal, p.prazoMeses, 1);
  const totalPrice = price * p.prazoMeses;
  const totalSac = principal + principal * taxaMensal * ((p.prazoMeses + 1) / 2);

  const list: Scenario[] = [
    {
      titulo: "obra atrasa 6 meses",
      impacto: 6 * (p.aluguel + principal * taxaMensal + p.seguros),
      explicacao: "6 meses a mais de aluguel e de juros de obra cheios. a construtora pode atrasar 180 dias sem multa.",
    },
    {
      titulo: "price × sac na 1ª parcela",
      impacto: sac1 - price,
      explicacao: "quanto a sac começa mais cara. ela cai todo mês; a price fica fixa.",
    },
    {
      titulo: "price × sac no total",
      impacto: totalPrice - totalSac,
      explicacao: "quanto a price custa a mais no prazo inteiro, sem contar seguros.",
    },
  ];

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
      explicacao: `quanto a parcela pode cair por mês se a amortização trouxer o boleto de volta à de tabela (${p.construtora.parcelaBase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`,
    });
  }

  return list;
}
