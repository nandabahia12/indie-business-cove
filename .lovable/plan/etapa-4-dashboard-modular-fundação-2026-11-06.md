# Etapa 4 — Dashboard modular (fundação)

## Situação atual
Clientes, propostas, contratos, agenda, finanças e tarefas ainda não têm tabelas. O painel mostra só dados reais. Por isso, nesta etapa os widgets desses módulos aparecem com um aviso claro de que o módulo ainda está sendo construído. Eles passam a mostrar números automaticamente quando cada módulo for entregue. Não haverá números fictícios nem botões sem ação.

## O que será construído
1. **Catálogo de widgets.** Os 12 widgets pedidos. Cada um é ligado a um módulo e a uma permissão:
   - Financeiro: faturamento, recebimentos pendentes, despesas e saldo. Freelancers e clientes não veem estes widgets.
   - Agenda: próximos compromissos e próximos eventos.
   - CRM: leads recentes.
   - Comercial: propostas aguardando resposta, contratos pendentes e indicadores comerciais.
   - Produção: tarefas atrasadas e entregas próximas.
2. **Adaptação.** O painel só mostra widgets de módulos ativos na organização que a pessoa tem permissão para ver. Quem não tem acesso não recebe os dados, porque a regra é aplicada no servidor e não só na tela.
3. **Estados dos widgets.**
   - Módulo ainda não construído: aviso de que a função estará disponível em breve.
   - Módulo pronto, mas sem registros: orientação de como começar, com link para a tela de cadastro.
   - Com dados: os números e um link para cada registro.
4. **Personalização.** Mostrar ou ocultar widgets, mudar a ordem (arrastar ou usar as setas, que também funcionam pelo teclado) e restaurar o padrão. A disposição é salva por pessoa e por organização.
5. **Filtro de período.** Este mês, mês passado, últimos 30 dias, este ano e um intervalo personalizado. O filtro fica no endereço da página e usa o fuso horário da organização (America/Bahia por padrão).
6. **Área de recomendações.** Por enquanto, mostra só itens verdadeiros: configuração inicial pendente, módulos aceitos mas ainda em construção e falta de equipe convidada. A área já fica preparada para receber as análises da IA, separando o que é fato do que é sugestão.
7. **Interface.** Grade limpa que se adapta à tela: 1 coluna no celular, 2 no tablet e 3 no computador. Mantém o visual atual da plataforma, sem a marca Luna Bahia.

## Fora desta etapa
Cadastros de clientes, finanças, agenda e outros módulos (ficam para as próximas etapas) e a geração real de análises por IA.

## Detalhes técnicos
- Nova tabela `user_dashboard_layouts (organization_id, user_id, widgets jsonb [{key, visible, order}], updated_at)`, com chave primária (org, user). Tem RLS que dá acesso só às próprias linhas e exige ser membro da organização, além de GRANTs. É uma migration aditiva. O teste de isolamento entre tenants será ampliado para cobri-la.
- `src/modules/dashboard/widgets.ts`: registro do tipo `{key, module, permission, size, status: 'pending_module'|'ready'}`.
- `dashboard.functions.ts`:
  - `getDashboardLayout` e `saveDashboardLayout` (validação com zod, só chaves do catálogo).
  - `getDashboardData({organizationId, from, to})`: filtra os widgets por módulo ativo e permissão. Cada provedor de dados é registrado por módulo e, por enquanto, só existem os que funcionam.
- Rota `/app` com `validateSearch` para o período. Usa `@dnd-kit/sortable` para reordenar. Estados de carregamento e erro.
- Testes:
  - Filtragem por módulo e permissão: um freelancer não recebe widgets financeiros.
  - O layout salvo aceita só chaves válidas.
  - Isolamento do layout entre organizações.
