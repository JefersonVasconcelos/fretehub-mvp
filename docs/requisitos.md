# FreteHub V2 - Requisitos do Produto

## Objetivo do produto

O FreteHub e uma aplicacao web para centralizar a gestao de fretes da Salvador Comercial, permitindo consultar pedidos, simular cotacoes, comparar transportadoras, controlar tarifas, acompanhar integracoes e gerar relatorios operacionais.

O objetivo principal e reduzir erro manual, dar visibilidade de custo e acelerar a decisao de frete antes do envio ao ERP, marketplace ou expedicao.

## Escopo da V2

A V2 deve ser tratada como a base operacional do produto. Ela preserva a V1 como demonstracao estatica, mas concentra a evolucao real no backend, banco de dados, autenticacao, permissoes, importacao e integracoes.

### Dentro do escopo

- Login com usuario e senha.
- Gestao de usuarios e perfis.
- Dashboard operacional.
- Consulta de pedidos.
- Simulacao e selecao de frete.
- Cadastro de transportadoras.
- Cadastro, edicao e duplicacao de tarifas.
- Importacao XLSX.
- Configuracao de Protheus.
- Configuracao de canais de venda.
- Relatorios.
- Auditoria.
- Configuracoes operacionais.
- Rentabilidade Marketplace.

### Fora do escopo imediato

- Integracoes reais sem credenciais oficiais.
- Calculo fiscal.
- Conciliacao financeira completa.
- Emissao de etiqueta.
- Rastreamento real em transportadoras.
- Aplicativo mobile nativo.
- Multitenancy para varias empresas.

## Usuarios e perfis

### Administrador

Responsavel por configuracoes, usuarios, perfis, integracoes e gestao completa.

Permissoes:

- Acesso total.
- Cadastrar e excluir usuarios.
- Configurar integracoes.
- Gerenciar tarifas e transportadoras.
- Consultar auditoria.

### Gestor de Logistica

Responsavel pela operacao de frete, contratos e tarifas.

Permissoes:

- Consultar pedidos.
- Gerar cotacoes.
- Selecionar frete.
- Gerenciar transportadoras.
- Gerenciar tarifas.
- Consultar relatorios e auditoria.

### Operador de Frete

Responsavel pelo uso diario da operacao.

Permissoes:

- Consultar pedidos.
- Gerar cotacoes.
- Selecionar frete.
- Consultar transportadoras e tarifas.
- Importar pedidos, quando autorizado.

### Financeiro

Responsavel por custos, divergencias e relatorios.

Permissoes:

- Consultar pedidos.
- Consultar custos.
- Consultar relatorios.
- Consultar auditoria.

### Consulta

Perfil somente leitura.

Permissoes:

- Consultar informacoes autorizadas.
- Sem permissao para alterar dados.

## Requisitos funcionais

### RF01 - Login

O sistema deve permitir acesso por email e senha.

Regras:

- Bloquear credenciais invalidas.
- Bloquear usuario inativo.
- Bloquear usuario excluido logicamente.
- Registrar evento de login.
- Retornar token de sessao.

### RF02 - Gestao de usuarios

O sistema deve permitir criar, listar e excluir usuarios.

Regras:

- Apenas Administrador pode executar.
- Email deve ser unico.
- Exclusao deve ser logica.
- Administrador nao pode excluir o proprio usuario.
- Usuario deve possuir ao menos um perfil.

### RF03 - Dashboard operacional

O sistema deve exibir uma visao rapida da operacao.

Indicadores minimos:

- Pedidos totais.
- Pedidos aguardando frete.
- Erros de integracao.
- Frete acima do limite.
- Tarifas vencidas.
- Tarifas proximas do vencimento.
- Custo por transportadora.
- Pedidos por canal.
- Pedidos recentes.

### RF04 - Pedidos

O sistema deve listar pedidos recebidos ou importados.

Regras:

- Buscar por numero, cliente ou CEP.
- Filtrar por canal.
- Filtrar por status.
- Exibir status operacional, Protheus e expedicao.
- Exportar CSV.

### RF05 - Cotacao de frete

O sistema deve calcular opcoes de frete com base em pedido, CEP, UF, peso, dimensoes, volumes e tarifas vigentes.

Regras:

- Validar campos obrigatorios.
- Calcular peso cubado.
- Usar o maior valor entre peso real e cubado.
- Desconsiderar transportadora inativa.
- Desconsiderar tarifa vencida.
- Indicar motivo quando nao houver opcao valida.
- Recomendar menor custo, menor prazo ou equilibrio.
- Permitir selecionar opcao de frete.

### RF06 - Transportadoras

O sistema deve permitir cadastro e manutencao de transportadoras.

Campos minimos:

- Nome fantasia.
- Razao social.
- CNPJ.
- Status.
- Modalidades.
- Estados atendidos.
- Fator de cubagem.
- Prazo medio.
- Contrato.
- Observacoes.

### RF07 - Tarifas

O sistema deve permitir criar, editar e duplicar tarifas.

Regras:

- Tarifa deve ter transportadora, servico, contrato, vigencia, rota, faixa de peso e valor.
- Tarifa deve possuir status.
- Tarifa duplicada deve criar nova versao em aprovacao ou rascunho.
- Tarifa vencida deve gerar alerta.

### RF08 - Importacao XLSX

O sistema deve importar pedidos e tarifas por XLSX.

Regras:

- Validar colunas obrigatorias.
- Registrar linhas validas.
- Registrar linhas com erro.
- Evitar duplicidade por hash do arquivo.
- Guardar historico da importacao.

### RF09 - Integracao Protheus

O sistema deve permitir configurar a integracao com TOTVS Protheus.

Regras:

- Configurar URL da API.
- Configurar ambiente.
- Configurar tipo de autenticacao.
- Salvar usuario e senha mascarada.
- Testar conexao.
- Exibir conectores.
- Exibir mapeamento.
- Exibir logs e fila.

### RF10 - Canais de venda

O sistema deve permitir configurar Mercado Livre, Shopee e Site Proprio.

Regras:

- Ativar e inativar canais.
- Salvar client ID, secret e frequencia.
- Sincronizar manualmente.
- Registrar log de sincronizacao.
- Permitir mapeamento de campos.

### RF11 - Relatorios

O sistema deve gerar relatorios para acompanhamento operacional e financeiro.

Relatorios minimos:

- Custo por periodo.
- Custo por transportadora.
- Custo por canal.
- Custo por estado/regiao.
- Pedidos sem cotacao.
- Divergencia entre frete calculado e cobrado.
- Tarifas vencidas.
- Tarifas proximas do vencimento.
- Desempenho de transportadoras.
- Pedidos fora do prazo.
- Frete previsto x realizado.

### RF12 - Auditoria

O sistema deve registrar eventos relevantes.

Eventos minimos:

- Login.
- Criacao, alteracao e exclusao de usuario.
- Criacao, alteracao e duplicacao de tarifa.
- Criacao e alteracao de transportadora.
- Geracao de cotacao.
- Selecao de frete.
- Salvamento de integracao.
- Teste de conexao.
- Sincronizacao de canal.

### RF13 - Configuracoes operacionais

O sistema deve permitir configurar regras gerais.

Regras minimas:

- Ambiente ativo.
- Separacao entre homologacao e producao.
- Backup logico.
- Confirmacao para exclusoes criticas.
- Validacao de formularios.
- Bloqueio de tarifas vencidas em simulacoes.
- Limite percentual de frete sobre valor do pedido.

### RF14 - Rentabilidade Marketplace

O sistema deve auditar a rentabilidade de produtos vendidos em Mercado Livre, Shopee e loja propria, considerando preco, custo, comissao, imposto, embalagem, frete gratis, parcelamento, ads e risco por cubagem.

Regras:

- Calcular preco minimo por marketplace.
- Calcular lucro estimado e margem por SKU.
- Gerar score de rentabilidade por SKU.
- Alertar prejuizo, margem abaixo da meta e risco por cubagem.
- Sugerir acao recomendada para cada SKU.
- Permitir importar SKUs por CSV.
- Permitir exportar o resultado da auditoria em CSV.
- Permitir baixar modelo CSV.
- Permitir editar e salvar premissas por canal.
- Registrar auditoria ao importar SKUs, salvar premissas e auditar margens.

## Requisitos nao funcionais

### RNF01 - Usabilidade

A interface deve ser limpa, objetiva e consistente, com menu lateral, topo fixo e feedback visual para acoes do usuario.

### RNF02 - Desempenho

As telas principais devem carregar rapidamente com a base demonstrativa e permanecer responsivas em operacao local.

### RNF03 - Seguranca

O sistema deve proteger endpoints com token e permissoes por perfil.

Evolucoes obrigatorias para producao:

- HTTPS.
- Segredo de token em variavel de ambiente.
- Politica de senha.
- Expiracao de sessao.
- Controle de tentativas de login.
- Mascaramento de credenciais.

### RNF04 - Confiabilidade

Falhas de importacao, cotacao ou integracao devem ser registradas sem derrubar a aplicacao.

### RNF05 - Auditabilidade

Acoes criticas devem possuir registro com usuario, data, entidade e detalhe.

### RNF06 - Manutenibilidade

Regras de negocio devem permanecer separadas da interface, principalmente o motor de cotacao.

### RNF07 - Portabilidade

A V1 deve continuar abrindo como HTML estatico. A V2 deve rodar localmente e evoluir para ambiente em nuvem.

### RNF08 - Escalabilidade

SQLite atende MVP local. Para uso real multiusuario, a recomendacao e migrar para PostgreSQL.

## Regras de negocio prioritarias

- Transportadora inativa nao pode ser recomendada.
- Tarifa vencida nao deve ser considerada valida.
- Peso cubado deve ser comparado com peso real.
- A opcao recomendada deve respeitar a prioridade informada.
- Usuario sem permissao nao pode alterar dados operacionais.
- Exclusao de usuario deve ser logica.
- Integracoes devem registrar sucesso, falha e mensagem.
- Pedido deve manter status operacional, Protheus e expedicao.
- Auditoria de rentabilidade deve ser rastreavel por usuario, data, SKU, canal e premissa aplicada.
- Preco minimo deve considerar custos fixos, custos variaveis e margem alvo configurada.
- Alerta de cubagem deve comparar peso cubado com peso real e orientar revisao de embalagem.

## Critérios de pronto para producao

- Ambiente publicado com HTTPS.
- Banco fora do repositorio.
- Credenciais fora do codigo.
- Backup configurado.
- Testes principais passando.
- Logs de erro visiveis.
- Fluxo de usuario validado.
- Fluxo de cotacao validado.
- Fluxo de tarifa validado.
- Documentacao atualizada.

