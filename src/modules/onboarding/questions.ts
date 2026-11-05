import type { OnboardingAnswers } from "./recommend";

export type ListField = "services" | "audience" | "billing_models" | "pains" | "admin_needs" | "finance_needs" | "marketing_needs";

export type Question =
  | { id: "business_name"; kind: "text"; prompt: string; required: true; placeholder: string }
  | { id: "segment_key"; kind: "segment"; prompt: string; required: true }
  | { id: "main_activity"; kind: "text"; prompt: string; required: false; placeholder: string }
  | { id: "team_size"; kind: "single"; prompt: string; required: false; options: { value: string; label: string }[] }
  | { id: ListField; kind: "multi"; prompt: string; required: false; options: string[]; useSegmentBilling?: boolean };

export const QUESTIONS: Question[] = [
  { id: "business_name", kind: "text", required: true, prompt: "Olá! Como seu negócio se chama? Pode ser seu nome profissional.", placeholder: "Ex.: Studio Aurora" },
  { id: "segment_key", kind: "segment", required: true, prompt: "Em qual área você atua?" },
  { id: "main_activity", kind: "text", required: false, prompt: "Em uma frase, o que você faz no dia a dia?", placeholder: "Ex.: Fotografo casamentos e eventos corporativos" },
  { id: "services", kind: "multi", required: false, prompt: "Quais serviços você oferece? Escreva e pressione Enter.", options: [] },
  { id: "audience", kind: "multi", required: false, prompt: "Quem você costuma atender?", options: ["Pessoas físicas", "Empresas", "Noivos", "Famílias", "Estudantes", "Pacientes"] },
  { id: "billing_models", kind: "multi", required: false, prompt: "Como você cobra pelos seus serviços?", options: [], useSegmentBilling: true },
  { id: "team_size", kind: "single", required: false, prompt: "Quantas pessoas trabalham com você?", options: [
    { value: "solo", label: "Só eu" }, { value: "2-5", label: "2 a 5" }, { value: "6-15", label: "6 a 15" }, { value: "16+", label: "Mais de 15" },
  ] },
  { id: "pains", kind: "multi", required: false, prompt: "O que mais dá trabalho hoje?", options: ["Controlar pagamentos", "Organizar a agenda", "Responder orçamentos", "Cumprir prazos de entrega", "Contratos e documentos", "Conseguir novos clientes"] },
  { id: "admin_needs", kind: "multi", required: false, prompt: "O que você quer organizar na parte administrativa?", options: ["Agenda e compromissos", "Contratos", "Prazos e entregas", "Tarefas da equipe", "Cadastro de clientes"] },
  { id: "finance_needs", kind: "multi", required: false, prompt: "E nas finanças?", options: ["Receber sinal e saldo", "Controlar parcelas", "Saber quanto entrou e saiu", "Lembrar vencimentos"] },
  { id: "marketing_needs", kind: "multi", required: false, prompt: "Por último, sobre divulgação e relacionamento:", options: ["Acompanhar leads", "Fazer follow-up", "Pedir indicações", "Reativar clientes antigos"] },
];

export const EMPTY_ANSWERS: OnboardingAnswers = {
  business_name: null, segment_key: null, main_activity: null, services: [], audience: [], billing_models: [],
  team_size: null, pains: [], admin_needs: [], finance_needs: [], marketing_needs: [],
};
