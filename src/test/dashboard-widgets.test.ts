import { describe, expect, it } from "vitest";
import { allowedWidgets, periodRange, resolveLayout } from "@/modules/dashboard/widgets";

const ALL = ["core", "crm", "comercial", "agenda", "producao", "financeiro"];

describe("dashboard widgets", () => {
  it("freelancer não recebe widgets financeiros", () => {
    const keys = allowedWidgets(ALL, ["core.read", "agenda.read", "producao.read"]).map((w) => w.key);
    expect(keys).not.toContain("revenue");
    expect(keys).not.toContain("balance");
    expect(keys).toContain("overdue_tasks");
  });
  it("módulo desativado oculta widgets mesmo com permissão", () => {
    const keys = allowedWidgets(["core"], ["financeiro.read"]).map((w) => w.key);
    expect(keys).toEqual([]);
  });
  it("layout salvo descarta chaves inválidas e não permitidas", () => {
    const allowed = allowedWidgets(["crm"], ["crm.read"]);
    const l = resolveLayout([{ key: "hack", visible: true }, { key: "revenue", visible: true }, { key: "leads", visible: false }], allowed);
    expect(l[0]).toEqual({ key: "leads", visible: false });
    expect(l.map((x) => x.key)).not.toContain("revenue");
    expect(l.map((x) => x.key)).not.toContain("hack");
  });
  it("período 'este mês' no fuso da Bahia", () => {
    expect(periodRange("this_month", "America/Bahia", new Date("2026-11-01T02:00:00Z"))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
});
