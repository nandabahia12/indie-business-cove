import { describe, expect, it } from "vitest";
import { emailNorm, isValidDoc, phoneNorm } from "@/modules/crm/normalize";

describe("normalização do CRM", () => {
  it("telefone compara só os números e ignora +55", () => {
    expect(phoneNorm("+55 (71) 99999-1234")).toBe("71999991234");
    expect(phoneNorm("71 99999.1234")).toBe("71999991234");
    expect(phoneNorm("")).toBeNull();
  });
  it("e-mail ignora maiúsculas e espaços", () => {
    expect(emailNorm("  Ana@Exemplo.COM ")).toBe("ana@exemplo.com");
  });
  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isValidDoc("529.982.247-25")).toBe(true);
    expect(isValidDoc("529.982.247-24")).toBe(false);
    expect(isValidDoc("111.111.111-11")).toBe(false);
    expect(isValidDoc("11.222.333/0001-81")).toBe(true);
    expect(isValidDoc("11.222.333/0001-80")).toBe(false);
  });
});
