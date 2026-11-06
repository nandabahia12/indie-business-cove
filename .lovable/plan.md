# Etapa 5 — CRM completo

## O que será construído
1. **Contatos.** Cadastro de pessoa física e jurídica com: nome, telefone, WhatsApp, e-mail, endereço, CPF/CNPJ (opcional e validado), origem, categoria, observações, preferências, tags e documentos anexos. Os documentos usam o armazenamento privado que já existe.
2. **Lista de contatos.** Busca por nome, telefone, e-mail ou documento. Filtros por categoria, tag, origem e etapa.
3. **Pipeline de oportunidades.** Cada contato pode ter uma ou mais oportunidades. Há duas formas de ver:
   - **Kanban:** mover entre etapas arrastando ou pelo menu, que também funciona pelo teclado e no celular.
   - **Tabela:** ordenação e filtros.
4. **Etapas personalizáveis.** Já vêm criadas as 9 etapas pedidas. Proprietários e administradores podem renomear, reordenar, criar e arquivar etapas. Uma etapa com oportunidades não pode ser excluída, só arquivada. "Contratado" e "Perdido" ficam marcadas como etapas de ganho e de perda.
5. **Ao mudar para Contratado:**
   - a data da conversão é registrada;
   - o histórico é preservado;
   - um lembrete de próximos passos é criado automaticamente, ligado ao contato e à oportunidade.
6. **Histórico cronológico.** Mostra tudo o que aconteceu com o contato: interações registradas (ligação, WhatsApp, e-mail, reunião, nota), mudanças de etapa, documentos e lembretes.
7. **Lembretes e próximas ações.** Cada lembrete tem data, responsável e situação (pendente ou concluído). Os lembretes também aparecem no painel inicial.
8. **Duplicados.** Antes de salvar, o sistema procura contatos com o mesmo e-mail, telefone ou WhatsApp (comparando só os números) ou com o mesmo CPF/CNPJ.
   - Se encontrar, mostra o contato existente e deixa você abrir o existente ou salvar mesmo assim.
   - Uma tela de revisão lista os possíveis duplicados. Você pode juntar dois contatos, levando todo o histórico, ou marcar que são pessoas diferentes.
9. **Entrada para formulários futuros.** Uma função interna recebe um contato, aplica a mesma checagem de duplicados e registra de onde ele veio. O formulário público não entra nesta etapa.
10. **Integração com outros módulos.**
    - O painel passa a mostrar números reais em "Leads recentes". Também mostra as oportunidades por etapa nos indicadores comerciais.
    - Comercial, Agenda e Financeiro vão usar o mesmo contato e a mesma oportunidade, sem cadastro duplicado. A ligação acontece quando esses módulos forem construídos.
11. **Permissões.** Cada ação exige a permissão correspondente do CRM: ver, criar, editar, excluir ou gerenciar.
    - Freelancers e clientes finais não acessam o CRM.
    - O CPF/CNPJ só aparece para quem pode editar contatos.
    - Cada exclusão pede confirmação e fica registrada.
12. **Interface.** O menu ganha "Clientes" e "Pipeline". A ficha do contato tem abas: dados, oportunidades, histórico, lembretes e documentos. Todas as telas mostram estados de carregamento, vazio e erro.

## Fora desta etapa
- Formulário público.
- Envio real por WhatsApp ou e-mail.
- Agenda, propostas e cobranças.

## Detalhes técnicos
Migration aditiva. Toda tabela tem `organization_id`, RLS por `has_org_permission(org,'crm.*')` e GRANTs.
- `crm_contacts`:
  - tipo pf/pj;
  - colunas normalizadas para busca de duplicados (`email_norm`, `phone_digits`, `whatsapp_digits`, `doc_digits`), com índices;
  - `source`, `category`, `notes`, `preferences jsonb`, `merged_into`, `archived_at`.
- `crm_tags` e `crm_contact_tags` (N:N).
- `crm_pipeline_stages`: `name`, `position`, `kind` (open/won/lost), `archived_at`. As etapas iniciais são criadas por organização quando o CRM é ativado e, retroativamente, nas organizações existentes.
- `crm_deals`: `contact_id`, `stage_id`, `title`, `value_cents`, `owner_id`, `won_at`, `lost_at`.
- `crm_interactions`: tipo, texto e data. Mudanças de etapa são registradas por um trigger.
- `crm_reminders`: `contact_id`, `deal_id`, `due_at`, `assignee_id`, `done_at`. Um trigger cria o lembrete quando a oportunidade entra em uma etapa de ganho.
- `crm_duplicate_dismissals`: guarda o par de contatos marcado como "pessoas diferentes".
- RPCs security definer:
  - `crm_find_duplicates`;
  - `crm_merge_contacts`: move negócios, interações, lembretes, tags e arquivos e registra auditoria.
- `files`: nova coluna `crm_contact_id` (nullable) para anexos.
- Arquivos novos: `src/modules/crm/*.functions.ts` (contacts, deals, stages, interactions, reminders, duplicates, intake) e as rotas `app.crm.index`, `app.crm.$contactId`, `app.crm.pipeline` e `app.crm.duplicates`. O widget "leads" do painel passa a `ready`.
- Testes:
  - normalização e detecção de duplicados;
  - trigger de "Contratado" criando o lembrete;
  - junção de contatos;
  - isolamento entre organizações em todas as tabelas novas;
  - freelancer sem acesso.
