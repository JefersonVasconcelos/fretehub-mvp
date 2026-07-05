# FreteHub V2 - Plano de Implantacao

## Objetivo

Definir o caminho para colocar o FreteHub V2 em uso real, com ambiente controlado, seguranca minima, banco persistente, rotina de backup e processo de evolucao.

## Estado atual

O projeto possui:

- V1 estatica preservada.
- V2 web com backend Python.
- Banco SQLite local.
- Autenticacao com token.
- Permissoes por perfil.
- Motor de cotacao.
- Importacao XLSX.
- Integracoes preparadas em modo demonstrativo.
- Testes automatizados parciais.
- Documentacao em `docs/`.

## Objetivo da primeira implantacao

Publicar um ambiente de homologacao acessivel por navegador para validacao operacional da V2.

Esse ambiente nao deve usar credenciais reais de Protheus, Mercado Livre ou Shopee ate que exista politica de seguranca e ambiente separado.

## Ambientes

### Local

Uso:

- Desenvolvimento.
- Ajustes visuais.
- Testes manuais.
- Testes automatizados.

Banco:

- SQLite local.

### Homologacao

Uso:

- Validacao com usuarios.
- Teste de fluxo de cotacao.
- Teste de cadastro de tarifas.
- Teste de importacao.
- Teste de integracoes simuladas ou credenciais de homologacao.

Banco:

- PostgreSQL ou SQLite isolado.

Obrigatorio:

- URL propria.
- Dados separados da producao.
- Usuario administrador controlado.
- Backup simples.

### Producao

Uso:

- Operacao real.

Obrigatorio:

- HTTPS.
- Banco PostgreSQL.
- Backup automatico.
- Segredos fora do codigo.
- Monitoramento.
- Logs.
- Controle de acesso.
- Processo de atualizacao.

## Opcoes de hospedagem

### Opcao recomendada para primeiro deploy

Render ou Railway.

Motivo:

- Baixa complexidade.
- Bom para MVP.
- Suporte a backend web.
- Possibilidade de banco gerenciado.

### Opcao Microsoft

Azure App Service + Azure Database for PostgreSQL.

Motivo:

- Boa opcao empresarial.
- Integra com ambiente corporativo.
- Escala melhor no futuro.

### Opcao AWS

Lightsail, Elastic Beanstalk ou ECS.

Motivo:

- Flexivel e robusto.
- Mais configuracao inicial.

## Etapas de implantacao

### Etapa 1 - Preparar repositorio

Atividades:

- Garantir branch `v2-fullstack` atualizada.
- Commitar documentacao e correcoes pendentes.
- Confirmar README.
- Separar dados locais do repositorio.
- Conferir `.gitignore`.

Resultado esperado:

- Repositorio pronto para deploy.

### Etapa 2 - Preparar configuracao

Atividades:

- Definir variaveis de ambiente.
- Definir segredo do token.
- Definir caminho/string do banco.
- Definir ambiente: homologacao.

Variaveis recomendadas:

```text
FRETEHUB_ENV=homologacao
FRETEHUB_SECRET=valor-seguro
FRETEHUB_DB=string-ou-caminho-do-banco
```

Resultado esperado:

- Aplicacao nao depende de segredo fixo no codigo.

### Etapa 3 - Publicar backend e frontend

Atividades:

- Criar servico web.
- Configurar comando de inicializacao.
- Configurar porta.
- Validar URL.

Comando atual:

```powershell
python server/app.py
```

Resultado esperado:

- V2 acessivel pelo navegador.

### Etapa 4 - Configurar banco

Atividades:

- Criar banco de homologacao.
- Rodar inicializacao.
- Criar usuario administrador.
- Validar login.

Resultado esperado:

- Dados persistentes fora do ambiente local.

### Etapa 5 - Validar fluxos principais

Checklist:

- Login.
- Dashboard.
- Pedidos.
- Simulador de frete.
- Transportadoras.
- Tarifas.
- Integracao Protheus.
- Canais de venda.
- Relatorios.
- Auditoria.
- Configuracoes.
- Usuarios.

Resultado esperado:

- Fluxos principais funcionando em homologacao.

### Etapa 6 - Criar rotina operacional

Atividades:

- Definir responsavel pelo ambiente.
- Definir rotina de backup.
- Definir canal para reportar erro.
- Definir processo de atualizacao.
- Definir frequencia de revisao de tarifas.

## Checklist antes de producao

- Banco PostgreSQL configurado.
- HTTPS ativo.
- Segredo fora do codigo.
- Credenciais criptografadas ou protegidas.
- Backup automatico.
- Logs consultaveis.
- Testes principais passando.
- Usuario administrador revisado.
- Perfis revisados.
- Dados demo removidos ou separados.
- Integracoes testadas em homologacao.
- Plano de rollback definido.

## Plano de rollback

Se uma publicacao quebrar a V2:

1. Interromper uso da nova versao.
2. Voltar para ultimo commit estavel.
3. Restaurar backup, se houver alteracao de banco.
4. Registrar incidente.
5. Corrigir em ambiente local.
6. Reimplantar somente apos validacao.

## Monitoramento minimo

Monitorar:

- Erros de login.
- Erros de API.
- Tempo de resposta.
- Falhas de importacao.
- Falhas de integracao.
- Uso do banco.
- Logs de auditoria.

## Roadmap de implantacao

### Curto prazo

- Homologacao publicada.
- Banco persistente.
- Documentacao atualizada.
- Testes principais funcionando.

### Medio prazo

- PostgreSQL.
- API em framework dedicado.
- CI/CD.
- Logs estruturados.
- Backup automatico.

### Longo prazo

- Integracoes reais.
- Fila de eventos.
- Monitoramento completo.
- Multiempresa.
- Modulo analitico.

