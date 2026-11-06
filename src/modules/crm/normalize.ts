/** Normalização usada na busca e na detecção de duplicados. Espelha as funções crm_* do banco. */
export function emailNorm(v?: string | null) {
  const s = (v ?? "").trim().toLowerCase();
  return s || null;
}

export function phoneNorm(v?: string | null) {
  const d = (v ?? "").replace(/\D/g, "");
  const out = /^55\d{10,11}$/.test(d) ? d.slice(2) : d.replace(/^0+/, "");
  return out || null;
}

export function digits(v?: string | null) {
  const d = (v ?? "").replace(/\D/g, "");
  return d || null;
}

/** Valida CPF (11 dígitos) ou CNPJ (14 dígitos) pelos dígitos verificadores. */
export function isValidDoc(v?: string | null) {
  const d = (v ?? "").replace(/\D/g, "");
  if ((d.length !== 11 && d.length !== 14) || d === d[0]!.repeat(d.length)) return false;
  const n = d.split("").map(Number);
  if (d.length === 11) {
    const dv = (len: number) => {
      let s = 0;
      for (let i = 0; i < len; i++) s += n[i]! * (len + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(9) === n[9] && dv(10) === n[10];
  }
  const dv = (w: number[]) => {
    const s = w.reduce((acc, wi, i) => acc + n[i]! * wi, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  return dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === n[12] && dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === n[13];
}

export function formatDoc(v?: string | null) {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v ?? "";
}

export const RELATIONSHIPS = { lead: "Lead", client: "Cliente", partner: "Parceiro", other: "Outro" } as const;
export const KINDS = { pf: "Pessoa física", pj: "Pessoa jurídica" } as const;
export const INTERACTION_KINDS = { call: "Ligação", whatsapp: "WhatsApp", email: "E-mail", meeting: "Reunião", note: "Nota" } as const;
export const PRIORITIES = { low: "Baixa", medium: "Média", high: "Alta" } as const;
export const CHANNEL_LABELS = { personal: "Pessoal", work: "Trabalho", whatsapp: "WhatsApp", other: "Outro" } as const;
export const CHANNEL_TYPES = { email: "E-mail", phone: "Telefone", whatsapp: "WhatsApp" } as const;

export const brl = (cents?: number | null) =>
  cents == null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
