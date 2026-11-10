/**
 * Cliente mínimo da API da Pluggy (só servidor), no plano pessoal do Meu Pluggy.
 *
 * - A API key dura 2 horas: é gerada a cada uso a partir do client id/secret.
 * - O plano pessoal não lista os itens (GET /items dá 401): os ids de cada
 *   banco conectado vêm do Dashboard e ficam em PLUGGY_ITEM_IDS.
 * - Transações em /v2/transactions, paginadas por cursor em `next`.
 */

const BASE = "https://api.pluggy.ai";
/** Trava contra laço infinito na paginação. */
const MAX_PAGES = 50;

export interface PluggyConfig {
  clientId: string;
  clientSecret: string;
  itemIds: string[];
}

/** Lê a configuração das variáveis de ambiente; null se faltar algo. */
export function pluggyConfig(): PluggyConfig | null {
  const clientId = process.env.CLIENT_ID_PLUGGY;
  const clientSecret = process.env.CLIENT_SECRET_PLUGGY;
  // Aceita "a,b" e também "\"a\",\"b\"" (aspas em volta de cada id).
  const itemIds = (process.env.PLUGGY_ITEM_IDS ?? "")
    .split(",")
    .map((id) => id.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  if (!clientId || !clientSecret || itemIds.length === 0) return null;
  return { clientId, clientSecret, itemIds };
}

export class PluggyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function pluggyClient(config: PluggyConfig) {
  const auth = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: config.clientId, clientSecret: config.clientSecret }),
    cache: "no-store",
  });
  if (!auth.ok) throw new PluggyError("Falha na autenticação com a Pluggy", auth.status);
  const { apiKey } = (await auth.json()) as { apiKey: string };

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { headers: { "X-API-KEY": apiKey }, cache: "no-store" });
    if (!res.ok) throw new PluggyError(`Pluggy ${path.split("?")[0]} respondeu ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  /** Próxima página: a Pluggy manda URL completa, caminho ou só a query string. */
  function nextPath(next: string | null | undefined, basePath: string): string | null {
    if (!next) return null;
    if (next.startsWith("http")) return next.replace(BASE, "");
    if (next.startsWith("/")) return next;
    return `${basePath}?${next.replace(/^\?/, "")}`;
  }

  return {
    item: (id: string) => get<PluggyItem>(`/items/${id}`),
    accounts: async (itemId: string) => (await get<{ results: PluggyAccount[] }>(`/accounts?itemId=${itemId}`)).results,
    investments: async (itemId: string) =>
      (await get<{ results: PluggyInvestment[] }>(`/investments?itemId=${itemId}`)).results,
    async transactions(accountId: string, dateFrom: string) {
      const out: PluggyRawTransaction[] = [];
      let path: string | null = `/v2/transactions?accountId=${accountId}&dateFrom=${dateFrom}`;
      for (let page = 0; path && page < MAX_PAGES; page++) {
        const body: { results?: PluggyRawTransaction[]; next?: string | null } = await get(path);
        out.push(...(body.results ?? []));
        path = nextPath(body.next, "/v2/transactions");
      }
      return out;
    },
  };
}

export interface PluggyItem {
  id: string;
  status: string;
  executionStatus?: string;
  lastUpdatedAt?: string | null;
  consentExpiresAt?: string | null;
  error?: { message?: string } | null;
  connector?: { name?: string };
}

export interface PluggyAccount {
  id: string;
  itemId: string;
  type: string;
  subtype: string;
  name: string;
  marketingName?: string | null;
  balance: number;
  bankData?: {
    reservedBalances?: { name?: string | null; availableAmounts?: { amount: number }[] }[];
  } | null;
  creditData?: {
    creditLimit?: number | null;
    availableCreditLimit?: number | null;
    balanceDueDate?: string | null;
  } | null;
}

export interface PluggyInvestment {
  type: string;
  subtype?: string | null;
  name: string;
  balance: number;
  status?: string | null;
}

export interface PluggyRawTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  status?: string | null;
  category?: string | null;
  operationType?: string | null;
  creditCardMetadata?: { installmentNumber?: number | null; totalInstallments?: number | null } | null;
}
