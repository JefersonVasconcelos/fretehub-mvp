# FreteHub - Estrategia de Produto

## Visao do produto

O FreteHub e uma plataforma de gestao de fretes para empresas que vendem por e-commerce, marketplaces e canais proprios.

A proposta e centralizar pedidos, tarifas, transportadoras, cotacoes, integracoes e relatorios em um unico ambiente, reduzindo erro operacional e melhorando a decisao de custo e prazo.

## Problema

Empresas com volume de pedidos em diferentes canais costumam enfrentar:

- Cotacao manual e demorada.
- Falta de comparacao clara entre transportadoras.
- Tarifas vencidas ou desatualizadas.
- Dificuldade de saber se o frete cobrado esta correto.
- Falhas de integracao sem rastreabilidade.
- Falta de relatorios por transportadora, canal e regiao.
- Dificuldade de saber se o SKU vendido no marketplace continua rentavel depois de frete, comissao, imposto e cubagem.
- Dependencia de planilhas.

## Publico-alvo inicial

### Usuario principal

Salvador Comercial.

### Perfis internos

- Gestor de logistica.
- Operador de frete.
- Financeiro.
- Administrador.
- Diretoria/gestao.

### Clientes futuros

- Pequenos e medios e-commerces.
- Distribuidoras.
- Lojas que vendem em Mercado Livre e Shopee.
- Empresas com ERP e operacao logistica terceirizada.
- Empresas que usam planilhas para controlar fretes.

## Proposta de valor

O FreteHub ajuda a empresa a escolher o melhor frete com mais controle, menor risco e melhor visibilidade.

Beneficios:

- Reduz tempo de cotacao.
- Reduz erro manual.
- Evita tarifa vencida.
- Compara custo e prazo.
- Centraliza transportadoras.
- Controla status de pedidos.
- Gera relatorios de custo.
- Registra auditoria.
- Prepara integracao com ERP e marketplaces.
- Mostra quais SKUs vendem com margem saudavel, margem apertada ou risco de prejuizo.

## Diferenciais

- Foco especifico em gestao de frete.
- Simulador com peso real e cubado.
- Controle de tarifa por vigencia.
- Tela de Protheus.
- Canais de venda integraveis.
- Rentabilidade Marketplace por SKU e canal.
- Alertas de prejuizo, frete gratis e cubagem.
- Auditoria operacional.
- V1 demonstrativa preservada e V2 evolutiva.
- Base simples para implantacao em empresas pequenas.

## Canais de entrada

- Mercado Livre.
- Shopee.
- Site Proprio.
- Protheus.
- Planilhas XLSX.
- Cadastro manual.

## Canais de saida

- Dashboard.
- Relatorios.
- Exportacao CSV.
- Logs de integracao.
- Envio futuro ao Protheus.
- Atualizacao futura de status para canais de venda.

## Modelo de uso

### Uso interno

A Salvador Comercial usa o FreteHub para controlar sua propria operacao de frete.

Valor gerado:

- Economia operacional.
- Menor retrabalho.
- Decisao mais rapida.
- Melhor visibilidade.

### Produto SaaS futuro

Empresas pagam assinatura para usar o FreteHub como sistema de gestao de frete.

Possiveis planos:

- Plano Inicial: pedidos e cotacoes.
- Plano Profissional: tarifas, relatorios e importacao.
- Plano Integrado: ERP, marketplaces e automacoes.

## Funcionalidades essenciais

Prioridade alta:

- Login.
- Pedidos.
- Simulador de frete.
- Transportadoras.
- Tarifas.
- Rentabilidade Marketplace.
- Relatorios.
- Usuarios.

Prioridade media:

- Importacao XLSX.
- Protheus.
- Canais de venda.
- Auditoria.
- Configuracoes.

Prioridade futura:

- Integracoes reais.
- Rastreamento.
- Conciliacao de frete cobrado.
- Regras avancadas por contrato.
- Recomendacao automatica de kits, embalagens e campanhas por SKU.
- BI e previsao de custo.

## Indicadores de sucesso

Operacionais:

- Tempo medio para cotar pedido.
- Pedidos sem cotacao.
- Pedidos com frete definido.
- Erros de integracao.
- Tarifas vencidas.
- Tarifas proximas do vencimento.

Financeiros:

- Custo total de frete.
- Custo por transportadora.
- Custo por canal.
- Divergencia entre frete calculado e cobrado.
- Percentual de frete sobre valor do pedido.
- SKUs com prejuizo estimado.
- Score medio de rentabilidade.
- Preco minimo por canal.

Produto:

- Usuarios ativos.
- Cotas geradas por dia.
- Importacoes realizadas.
- Relatorios exportados.
- Acoes registradas em auditoria.

## Estrategia de evolucao

### Fase 1 - MVP operacional

Objetivo:

- Fazer a V2 funcionar bem localmente com dados demonstrativos e fluxos principais.

Entregas:

- Dashboard.
- Pedidos.
- Cotacao.
- Transportadoras.
- Tarifas.
- Relatorios.
- Usuarios.
- Rentabilidade Marketplace com importacao, exportacao e auditoria.

### Fase 2 - Homologacao

Objetivo:

- Publicar V2 em ambiente acessivel para validacao.

Entregas:

- Deploy web.
- Banco persistente.
- Backup.
- Login real.
- Testes principais.

### Fase 3 - Integracoes

Objetivo:

- Conectar o FreteHub ao ecossistema real.

Entregas:

- Protheus homologacao.
- Mercado Livre homologacao.
- Shopee homologacao.
- Fila de logs.
- Reprocessamento.

### Fase 4 - Produto comercial

Objetivo:

- Preparar FreteHub como SaaS.

Entregas:

- Multiempresa.
- Planos de assinatura.
- Onboarding.
- Monitoramento.
- Suporte.
- Documentacao comercial.

## Riscos de negocio

| Risco | Impacto | Acao |
|---|---|---|
| Integracoes complexas | Alto | Comecar por homologacao e logs |
| Tarifas mal cadastradas | Alto | Validacoes e aprovacao |
| Usuario nao adotar | Medio | Interface simples e treinamento |
| Custo de nuvem | Medio | Comecar pequeno |
| Escopo crescer demais | Medio | Roadmap priorizado |

## Posicionamento

FreteHub deve ser posicionado como uma solucao simples e pratica para empresas que precisam controlar frete sem depender apenas de planilhas.

Mensagem principal:

```text
Controle seus fretes, compare transportadoras e proteja sua margem por pedido, canal e SKU em uma unica plataforma.
```

