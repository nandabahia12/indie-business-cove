# Plano Técnico — SaaS Multitenant Modular com IA

Observação: a especificação "apresentada anteriormente" não está disponível nesta conversa. Este plano parte do que foi descrito nesta mensagem (CRM, comercial, agenda, financeiro, produção, documentos, IA; construtor de sites no futuro). Se houver detalhes adicionais, envie-os para ajustarmos o plano antes de começar.

## 1. Arquitetura geral

```text
[Navegador - React 19 + TanStack Router]
        |  (rotas, UI, design system)
        v
[TanStack Start - funções de servidor (Cloudflare Workers)]
   |-- Middleware: autenticação + resolução do tenant ativo
   |-- Serviços por módulo (crm, comercial, agenda, financeiro, producao, documentos, ia)
   |-- Rotas públicas /api/public/* (webhooks, links públicos de proposta/contrato)
        |
        v
[Lovable Cloud]
   |-- Postgres com RLS por tenant
   |-- Auth (e-mail/senha, Google)
   |-- Storage (arquivos por tenant)
   |-- Cron (lembretes, automações agendadas)
        |
        v
[Lovable AI Gateway] (textos, resumos, sugestões, extração de dados)
```

Princípios: monólito modular (um app, módulos isolados por pasta e por prefixo de tabela), toda leitura/escrita passa por RLS, nenhum módulo acessa tabelas internas de outro diretamente — usa as entidades centrais compartilhadas ou serviços expostos.

## 2. Módulos e dependências

```text
Núcleo (tenants, membros, papéis, contatos, arquivos, atividades, configurações)
  ├── CRM         -> Núcleo
  ├── Comercial   -> CRM (orçamentos/propostas para contatos e oportunidades)
  ├── Agenda      -> CRM, Comercial (eventos vinculados a projetos)
  ├── Produção    -> Comercial (projeto nasce de proposta aprovada), Agenda
  ├── Financeiro  -> Comercial, Produção (cobranças por projeto/proposta)
  ├── Documentos  -> Comercial, Produção (contratos, termos, entregas)
  └── IA          -> transversal, lê via serviços dos demais módulos
Futuro: Construtor de sites -> Núcleo, CRM (captura de leads), Comercial (catálogo)
```

Módulos são habilitáveis por tenant (tabela `tenant_modules`), permitindo planos e segmentos diferentes.

## 3. Multitenancy

- Banco único, esquema compartilhado, coluna `tenant_id` em toda tabela de negócio.
- Usuário pode pertencer a vários tenants (`tenant_members`); tenant ativo escolhido na interface e enviado às funções de servidor.
- RLS usa função `is_tenant_member(tenant_id)` e `has_tenant_role(tenant_id, role)` (security definer), evitando recursão.
- Storage: arquivos em caminho `tenant_id/...` com políticas equivalentes.
- Segmento do tenant (`segment`: fotografia, eventos, beleza, consultoria...) direciona modelos padrão, vocabulário e campos personalizados — sem código específico por segmento.

## 4. Autenticação e autorização

- Lovable Cloud Auth: e-mail/senha e Google.
- Papéis por tenant em tabela separada `tenant_member_roles` (owner, admin, member, viewer). Nunca na tabela de perfil.
- Permissões finas por módulo (ex.: `financeiro.read`) mapeadas por papel em `role_permissions`, checadas no servidor e na RLS.
- Rotas protegidas sob layout `_authenticated`; links públicos (assinar proposta) via token aleatório com escopo e expiração.

## 5. Modelo inicial de dados

Núcleo
- `tenants` (id, name, slug, segment, settings jsonb, plan)
- `profiles` (user_id, name, avatar)
- `tenant_members` (tenant_id, user_id, status)
- `tenant_member_roles` (tenant_id, user_id, role)
- `tenant_modules` (tenant_id, module_key, enabled)
- `contacts` (tenant_id, type pessoa/empresa, name, email, phone, doc, tags)
- `files` (tenant_id, owner_entity, owner_id, path, mime)
- `activities` (tenant_id, entity_type, entity_id, kind, payload, actor) — linha do tempo compartilhada
- `custom_fields` / `custom_field_values` — flexibilidade por segmento

CRM
- `crm_pipelines`, `crm_stages`, `crm_deals` (contact_id, stage_id, value, source)
- `crm_notes`, `crm_tasks`

Comercial
- `catalog_items` (serviços/pacotes, preço, duração)
- `quotes` (deal_id, contact_id, status, total, public_token, valid_until)
- `quote_items`

Agenda
- `calendars`, `events` (tenant_id, start, end, type, contact_id, project_id, location)
- `availability_rules`

Produção
- `projects` (quote_id, contact_id, status, event_date)
- `project_stages`, `project_tasks`, `deliverables` (prazo, status, file_id)

Financeiro
- `accounts`, `categories`
- `transactions` (tipo receita/despesa, valor, vencimento, pago_em, project_id)
- `installments` (quote/project, parcela, status)

Documentos
- `document_templates` (tipo, corpo com variáveis)
- `documents` (template_id, entity, conteúdo gerado, status, public_token)
- `document_signatures` (aceite eletrônico simples: nome, IP, data)

IA e automações
- `ai_requests` (tenant_id, feature, tokens, status) — auditoria e limites
- `automations` (gatilho, condições, ações), `automation_runs`

Futuro (somente reservado): `sites`, `site_pages` — não criados agora.

## 6. Compartilhamento entre módulos

- Entidades centrais (`contacts`, `files`, `activities`) são a "cola".
- Fluxo principal: Lead (CRM) → Orçamento (Comercial) → aprovado gera Projeto (Produção) + Eventos (Agenda) + Parcelas (Financeiro) + Contrato (Documentos).
- Eventos de domínio registrados em `domain_events` (ex.: `quote.approved`) consumidos por automações, mantendo módulos desacoplados.

## 7. IA e automações

- Todas as chamadas via funções de servidor ao Lovable AI Gateway; chave nunca no navegador.
- Funcionalidades iniciais: redigir proposta e mensagens, resumir histórico do cliente, gerar contrato a partir de modelo, sugerir próximos passos no pipeline, extrair dados de texto colado (ex.: briefing).
- Contexto montado por serviços com filtro de tenant; registro em `ai_requests` para custo e limites por plano.
- Automações: regras simples gatilho→ação executadas por eventos de domínio e cron (lembretes de vencimento, follow-up, prazo de entrega).

## 8. Integrações externas

Disponíveis e previstas:
- Lovable Cloud (banco, auth, storage, cron) e Lovable AI Gateway.
- E-mail transacional via Lovable (requer domínio de e-mail configurado).
- Pagamentos: Stripe ou Paddle (assinatura do SaaS; cobrança dos clientes finais avaliada depois).
- Google Calendar via conector (sincronização de agenda) — etapa posterior.
Não previstas agora: WhatsApp oficial, emissão de nota fiscal, assinatura com validade ICP-Brasil — dependem de provedores terceiros a definir.

## 9. Componentes e design system

- shadcn/ui + Tailwind v4 com tokens semânticos em `styles.css`, modo claro/escuro.
- Direção visual própria (tipografia e paleta a definir com você antes da primeira tela).
- Componentes compartilhados: AppShell (barra lateral por módulo), DataTable, EntityForm, Kanban, Calendar, Timeline, StatusBadge, MoneyInput, EmptyState, AIAssistPanel.

## 10. Estrutura de pastas

```text
src/
  routes/
    _authenticated/
      app/$tenant/crm/... comercial/... agenda/... producao/... financeiro/... documentos/...
    p/ (páginas públicas: proposta, contrato)
    api/public/ (webhooks)
  modules/
    core/  crm/  comercial/  agenda/  producao/  financeiro/  documentos/  ia/
      (cada um: *.functions.ts, queries.ts, schemas.ts, components/)
  components/ui/      (design system)
  components/shared/  (DataTable, Kanban, Timeline...)
  lib/                (tenant, permissões, formatação, eventos)
supabase/migrations/  (uma migração por módulo)
```

## 11. Tecnologias

TanStack Start v1, React 19, Vite 7, Tailwind v4, shadcn/ui, TanStack Query, Zod, react-hook-form, date-fns, Lovable Cloud, Lovable AI Gateway, Vitest.

## 12. Riscos técnicos

- Vazamento entre tenants por política RLS incorreta — mitigação: testes automatizados de isolamento por tabela.
- Excesso de acoplamento entre módulos — mitigação: eventos de domínio e serviços públicos por módulo.
- Custos de IA — limites por plano e auditoria em `ai_requests`.
- Campos personalizados com jsonb dificultam relatórios — limitar uso e indexar.
- Ambiente de servidor (Workers) não suporta bibliotecas exclusivas de Node (ex.: geração de PDF pesada) — avaliar alternativa compatível.
- Validade jurídica de aceite eletrônico simples — deixar claro ao usuário.

## 13. Plano de implementação por etapas

1. Fundação: Lovable Cloud, design system, auth, tenants, membros, papéis, RLS base, AppShell, onboarding com escolha de segmento, testes de isolamento.
2. CRM: contatos, pipeline Kanban, notas, tarefas, linha do tempo.
3. Comercial: catálogo, orçamentos, página pública de aprovação.
4. Agenda: calendário, eventos vinculados, disponibilidade.
5. Produção: projeto gerado por orçamento aprovado, etapas, entregáveis.
6. Financeiro: lançamentos, parcelas, fluxo de caixa, vencimentos.
7. Documentos: modelos com variáveis, geração, aceite eletrônico.
8. IA: assistente por módulo (propostas, resumos, contratos, sugestões).
9. Automações e notificações por e-mail; assinatura do SaaS (pagamentos).
10. Integração Google Calendar, relatórios e painel.
Futuro: construtor de sites (usa Núcleo, CRM e catálogo já existentes).

Cada etapa termina com revisão sua antes de seguir para a próxima.
