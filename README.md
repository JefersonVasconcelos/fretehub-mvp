# FreteHub MVP

Aplicacao para gestao e cotacao de fretes da Salvador Comercial.

O projeto nasceu como MVP demonstrativo e evoluiu para uma V2 full-stack, mantendo a V1 preservada para demonstracao.

## Versoes

### V1 demonstrativa

A V1 fica na raiz do projeto:

- `index.html`
- `app.js`
- `styles.css`

Ela e uma versao estatica, sem backend, banco ou autenticacao real. Pode ser aberta direto no navegador e publicada no GitHub Pages.

### V2 full-stack

A V2 fica em:

- Frontend: `apps/web`
- Backend/API: `server/app.py`
- Modulos backend: `server/fretehub`
- Testes: `tests`

A V2 inclui:

- Backend/API em Python.
- Banco SQLite real.
- Autenticacao por email e senha.
- Motor de cotacao separado da interface.
- Importacao XLSX via API.
- Integracoes preparadas para Protheus, Mercado Livre e Shopee.
- Gestao de transportadoras, tarifas, pedidos, relatorios, auditoria e configuracoes.
- Testes automatizados.

## Como rodar a V1

Abra o arquivo abaixo no navegador:

```text
index.html
```

Nao precisa instalar nada.

## Como rodar a V2 localmente

No PowerShell:

```powershell
cd "C:\Users\vasco\Documents\Codex\2026-07-03\analise-esta-aplica-o-fretehub-identifique\fretehub-mvp"
python server/app.py
```

Se `python` nao funcionar, tente:

```powershell
py server/app.py
```

Depois abra no navegador:

```text
http://localhost:8000/apps/web/
```

## Login demo da V2

```text
Email: admin@salvadorcomercial.com.br
Senha: Admin123!
```

## Banco de dados

A V2 usa SQLite local.

O banco e criado automaticamente quando o servidor inicia:

```text
server/data/fretehub.sqlite
```

Se precisar reiniciar os dados demonstrativos, pare o servidor, remova o arquivo SQLite e rode novamente:

```powershell
Remove-Item server\data\fretehub.sqlite
python server/app.py
```

## Testes

Para rodar todos os testes:

```powershell
python -m unittest discover -s tests
```

Ou, se o comando `python` nao estiver disponivel:

```powershell
py -m unittest discover -s tests
```

## GitHub e branches

Repositorio:

```text
https://github.com/JefersonVasconcelos/fretehub-mvp
```

Branches principais:

- `main`: base/V1 demonstrativa.
- `v2-fullstack`: V2 completa com backend, banco, autenticacao e telas evoluidas.

Para enviar alteracoes da V2:

```powershell
git status
git add .
git commit -m "Descreva a alteracao"
git push -u origin v2-fullstack
```

Se aparecer erro de `dubious ownership`, execute:

```powershell
git config --global --add safe.directory "C:/Users/vasco/Documents/Codex/2026-07-03/analise-esta-aplica-o-fretehub-identifique/fretehub-mvp"
```

Se o push for recusado porque o remoto tem commits novos:

```powershell
git pull --rebase origin v2-fullstack
git push -u origin v2-fullstack
```

Se aparecer conflito no rebase, pare e resolva antes de continuar.

## GitHub Pages

O GitHub Pages roda bem a V1 estatica.

A V2 completa nao roda somente no GitHub Pages, porque precisa de backend Python e banco SQLite.

Para publicar a V1 no GitHub Pages:

1. Acesse o repositorio no GitHub.
2. Entre em `Settings > Pages`.
3. Em `Build and deployment`, selecione:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
4. Salve.

## Estrutura principal

```text
fretehub-mvp/
  index.html
  app.js
  styles.css
  VERSION_02.md
  apps/
    web/
      index.html
      app.js
      styles.css
  server/
    app.py
    fretehub/
      auth.py
      database.py
      integrations.py
      migrations.py
      permissions.py
      quote_engine.py
      xlsx_importer.py
  tests/
```

## Observacoes importantes

- As integracoes externas estao preparadas, mas nao fazem chamadas reais sem credenciais/API tokens.
- A V2 deve ser rodada localmente ou em um servidor que suporte Python.
- A V1 deve permanecer preservada como demonstracao.
- Antes de alterar arquivos importantes, revise o estado com `git status`.

