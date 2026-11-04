# Remix of Nexo Business Orbit

Antes de desenvolver qualquer funcionalidade, quero que você analise integralmente a especificação do produto apresentada anteriormente e transforme essa visão em um plano técnico de desenvolvimento.

Estamos construindo um SaaS multitenant, modular, escalável e orientado por IA, destinado a profissionais autônomos e pequenas empresas de diferentes segmentos.

O primeiro caso de uso será uma profissional de cobertura documental de stories, fotografia e eventos, mas o sistema não poderá ficar limitado a esse segmento.

Neste momento, NÃO desenvolva o produto inteiro e NÃO comece criando telas aleatórias.

Sua tarefa é:

Definir a arquitetura geral da aplicação.

Identificar os módulos e suas dependências.

Propor a arquitetura do banco de dados relacional.

Definir a estratégia de multitenancy.

Planejar autenticação e autorização.

Definir como será implementado o controle de acesso e RLS.

Identificar entidades centrais e entidades específicas de cada módulo.

Definir como os módulos compartilharão informações.

Planejar a arquitetura de IA e automações.

Identificar integrações externas necessárias.

Definir a estrutura de componentes e design system.

Criar uma sequência de implementação incremental.

DECISÃO IMPORTANTE DE ESCOPO:

O construtor de sites não será desenvolvido agora. Ele deverá permanecer no roadmap futuro, com arquitetura preparada para sua inclusão, mas sem consumir recursos da primeira versão.

Priorize inicialmente CRM, comercial, agenda, financeiro, produção, documentos e IA.

Apresente:

Diagrama arquitetural.

Modelo inicial de dados.

Relações entre módulos.

Estrutura de pastas.

Tecnologias recomendadas.

Riscos técnicos.

Dependências.

Plano de implementação por etapas.

Não invente integrações ou funcionalidades indisponíveis.

Não comece a implementação até apresentar o planejamento e permitir sua revisão.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/efe4a18e-df50-4673-b8e1-795fc2a9459c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
