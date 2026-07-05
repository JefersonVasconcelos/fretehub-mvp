# FreteHub Versao 02 - Full-stack

Esta branch preserva a V1 demonstrativa e adiciona uma base full-stack para evolucao real do MVP.

## O que existe nesta versao

- Backend/API em Python sem dependencias externas.
- Banco SQLite real em `server/data/fretehub.sqlite`.
- Autenticacao por email/senha com token assinado.
- Motor de cotacao testavel e separado da interface.
- Importacao XLSX via API usando leitura do arquivo `.xlsx`.
- Conectores preparados para Protheus, Mercado Livre e Shopee.
- Frontend V2 em `apps/web`, consumindo a API.
- Testes automatizados em `tests`.

## Como rodar localmente

```powershell
cd fretehub-mvp
python server/app.py
```

Depois abra:

```text
http://localhost:8000/apps/web/
```

## Login demo

```text
admin@salvadorcomercial.com.br
Admin123!
```

## Testes

```powershell
python -m unittest discover -s tests
```

## Observacao

As integracoes externas estao preparadas como conectores, mas nao fazem chamadas reais sem credenciais/API tokens.
