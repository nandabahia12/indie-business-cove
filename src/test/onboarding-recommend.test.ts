import { describe, expect, it } from "vitest";
import { recommend, type CatalogModule, type OnboardingAnswers, type SegmentTemplate } from "@/modules/onboarding/recommend";
import { EMPTY_ANSWERS } from "@/modules/onboarding/questions";

const catalog: CatalogModule[] = [
  ["core", true, true], ["crm", true, true], ["comercial", false, true], ["agenda", false, true], ["producao", false, true],
  ["financeiro", false, true], ["documentos", false, true], ["alunos", false, false], ["turmas", false, false], ["frequencia", false, false],
].map(([key, is_core, is_available]) => ({ key: key as string, name: key as string, is_core: is_core as boolean, is_available: is_available as boolean }));

const tpl = (key: string, modules: string[], future: string[] = [], sensitive = false): SegmentTemplate => ({
  key, name: key, modules, future_modules: future, flows: [], sensitive_data: sensitive, privacy_notice: sensitive ? "aviso" : null,
});
const a = (p: Partial<OnboardingAnswers>): OnboardingAnswers => ({ ...EMPTY_ANSWERS, ...p });
const keys = (r: ReturnType<typeof recommend>) => r.modules.map((m) => m.key).sort();

describe("recomendação de onboarding", () => {
  it("fotografia: CRM sempre, mais comercial, agenda, produção, financeiro e documentos", () => {
    const r = recommend(a({}), tpl("foto", ["crm", "comercial", "agenda", "producao", "financeiro", "documentos"]), catalog);
    expect(keys(r)).toEqual(["agenda", "comercial", "documentos", "financeiro", "producao"]);
    expect(r.coreModules.map((m) => m.key)).toEqual(["core", "crm"]);
  });

  it("aulas: alunos, turmas e frequência ficam como 'em breve', nunca ativados", () => {
    const r = recommend(a({}), tpl("aulas", ["crm", "agenda", "financeiro"], ["alunos", "turmas", "frequencia"]), catalog);
    expect(keys(r)).toEqual(["agenda", "financeiro"]);
    expect(r.futureModules.map((m) => m.key)).toEqual(["alunos", "turmas", "frequencia"]);
  });

  it("saúde: mostra aviso de privacidade", () => {
    const r = recommend(a({}), tpl("saude", ["agenda", "documentos"], [], true), catalog);
    expect(r.notices).toEqual(["aviso"]);
  });

  it("respostas acrescentam módulos: dificuldade com pagamentos → financeiro; equipe → produção", () => {
    const r = recommend(a({ pains: ["Controlar pagamentos"], team_size: "2-5" }), tpl("g", []), catalog);
    expect(keys(r)).toEqual(["financeiro", "producao"]);
  });

  it("padrões: BRL e fuso America/Bahia", () => {
    const r = recommend(a({}), null, catalog);
    expect(r.settings.currency).toBe("BRL");
    expect(r.settings.timezone).toBe("America/Bahia");
  });
});
