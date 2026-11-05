# Etapa 3 — Onboarding inteligente

## O que o usuário verá
1. Após criar a conta (ou ao criar uma nova organização), abre um assistente em formato de conversa: uma pergunta por vez, com sugestões clicáveis e campo livre. Barra de progresso e botão "Pular" em toda pergunta não essencial.
2. Obrigatórios: apenas nome profissional/empresarial e segmento. Todo o resto é opcional.
3. Perguntas, na ordem: nome, segmento, atividade principal, serviços oferecidos, público atendido, modelo de cobrança, quantidade de colaboradores, principais dificuldades, necessidades administrativas, financeiras e de marketing. Perguntas seguintes se adaptam ao segmento (ex.: saúde mostra aviso de privacidade; aulas sugerem "mensalidade").
4. Tela de recomendações: módulos sugeridos, configurações iniciais (moeda BRL, fuso America/Bahia editável, formato de data) e fluxos iniciais (ex.: Lead → Proposta → Contrato → Evento → Entrega). Cada item com "Aceitar", "Editar" ou "Rejeitar", e o motivo da recomendação.
5. Ao confirmar, as escolhas são gravadas e o usuário vai para o dashboard, que mostra os módulos ativados e os próximos passos sugeridos. O onboarding pode ser retomado depois (respostas salvas a cada passo).

## Como as recomendações são geradas
- **Base por regras (sempre funciona):** modelos de segmento guardados no banco (fotografia/eventos, aulas/academias, saúde, consultoria, beleza, genérico), cada um listando módulos, configurações e fluxos sugeridos. Novas profissões = novo registro, sem alterar código.
- **Refinamento por IA (opcional):** a IA lê as respostas e ajusta a sugestão (ex.: incluir financeiro se a dificuldade for "controlar pagamentos"), sempre escolhendo apenas entre módulos que existem no catálogo e explicando o motivo. Se a IA falhar, vale a sugestão por regras. Nada é ativado sem a confirmação do usuário (nível "assistido").
- Módulos ainda não construídos (alunos, turmas, frequência, galerias) aparecem como "em breve" — registrados como interesse, não ativados como se existissem.

## Luna Bahia
- Preparar o modelo de segmento "Fotografia e cobertura de eventos" com módulos CRM, comercial, agenda, produção/entregas, financeiro e documentos/contratos, e o fluxo do evento.
- Ao final do onboarding da organização da Luna Bahia, oferecer importar os pacotes de referência já informados (Madeleine, Éloise, Blanche, hora adicional, desconto à vista, sinal de 30%, prazos de entrega) como configurações editáveis — apenas se ela aceitar. Nenhum outro dado (endereço, CNPJ, contatos) será cadastrado. Esses valores ficam só nessa organização, nunca como padrão global.

## Pendência para confirmar
- Os pacotes da Luna Bahia serão guardados como configurações da organização agora; quando o módulo Comercial for construído, migram para o catálogo de serviços.

## Detalhes técnicos
- Migração aditiva:
  - `segment_templates` (global, somente leitura para autenticados): key, nome, descrição, módulos sugeridos, configurações padrão, fluxos, perguntas extras, flag de dado sensível.
  - `organization_onboarding` (por organização, RLS por membro; escrita só owner/admin): respostas por pergunta (colunas tipadas para segmento, colaboradores, cobrança; listas em arrays de texto), status (em andamento/concluído), passo atual, recomendação gerada e decisões (aceito/editado/rejeitado por item), concluído em/por.
  - Ampliar catálogo `modules` com módulos futuros marcados `available=false`.
  - RPC security definer `complete_onboarding(org, decisões)`: valida papel, ativa/desativa `organization_modules`, grava `organization_settings`, atualiza `organizations.segment`, escreve auditoria — tudo numa transação.
- Server functions em `src/modules/onboarding/onboarding.functions.ts` (salvar passo, gerar recomendação, concluir) com `requireSupabaseAuth`, Zod e `fromDbError`.
- IA via Lovable AI Gateway (modelo padrão, saída estruturada restrita às chaves do catálogo), contexto só da organização atual; registrar uso.
- Rotas: `/_authenticated/app/onboarding`; o layout `/app` redireciona para o onboarding se a organização ativa não concluiu. Dashboard (`app.index`) passa a mostrar módulos ativos e próximos passos reais.
- Testes: regra de recomendação por segmento (fotografia, aulas, saúde), conclusão só por owner/admin, isolamento de `organization_onboarding` entre tenants (estender teste de integração).
- Ao final: atualizar memória e roadmap com o que foi implementado e pendências.
