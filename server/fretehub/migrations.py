import json
import uuid
from datetime import date, timedelta


MIGRATIONS = [
    (
        "20260704_001_modelo_operacional",
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS perfis (
          id TEXT PRIMARY KEY,
          codigo TEXT NOT NULL UNIQUE,
          nome TEXT NOT NULL,
          descricao TEXT,
          ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS usuario_perfis (
          id TEXT PRIMARY KEY,
          usuario_id TEXT NOT NULL REFERENCES users(id),
          perfil_id TEXT NOT NULL REFERENCES perfis(id),
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (usuario_id, perfil_id)
        );
        CREATE INDEX IF NOT EXISTS idx_usuario_perfis_usuario ON usuario_perfis(usuario_id);
        CREATE INDEX IF NOT EXISTS idx_usuario_perfis_perfil ON usuario_perfis(perfil_id);

        CREATE TABLE IF NOT EXISTS servicos_transportadora (
          id TEXT PRIMARY KEY,
          transportadora_id TEXT NOT NULL REFERENCES carriers(id),
          codigo TEXT NOT NULL,
          nome TEXT NOT NULL,
          descricao TEXT,
          modalidade TEXT NOT NULL,
          prazo_base_dias INTEGER NOT NULL DEFAULT 0 CHECK (prazo_base_dias >= 0),
          fator_cubagem REAL NOT NULL CHECK (fator_cubagem > 0),
          peso_minimo_kg REAL NOT NULL DEFAULT 0 CHECK (peso_minimo_kg >= 0),
          peso_maximo_kg REAL NOT NULL DEFAULT 99999 CHECK (peso_maximo_kg >= peso_minimo_kg),
          ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          excluido_em TEXT,
          UNIQUE (transportadora_id, codigo)
        );
        CREATE INDEX IF NOT EXISTS idx_servicos_transportadora ON servicos_transportadora(transportadora_id, ativo);

        CREATE TABLE IF NOT EXISTS contratos_transportadora (
          id TEXT PRIMARY KEY,
          transportadora_id TEXT NOT NULL REFERENCES carriers(id),
          numero_contrato TEXT NOT NULL,
          descricao TEXT,
          data_inicio TEXT NOT NULL,
          data_fim TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('RASCUNHO', 'ATIVO', 'VENCIDO', 'CANCELADO', 'ENCERRADO')),
          responsavel TEXT,
          observacoes TEXT,
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (transportadora_id, numero_contrato)
        );
        CREATE INDEX IF NOT EXISTS idx_contratos_status_vigencia ON contratos_transportadora(status, data_fim);

        CREATE TABLE IF NOT EXISTS tabelas_tarifa (
          id TEXT PRIMARY KEY,
          transportadora_id TEXT NOT NULL REFERENCES carriers(id),
          contrato_id TEXT NOT NULL REFERENCES contratos_transportadora(id),
          servico_transportadora_id TEXT NOT NULL REFERENCES servicos_transportadora(id),
          codigo TEXT NOT NULL,
          nome TEXT NOT NULL,
          versao INTEGER NOT NULL CHECK (versao > 0),
          data_inicio_vigencia TEXT NOT NULL,
          data_fim_vigencia TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('RASCUNHO', 'EM_APROVACAO', 'ATIVA', 'VENCIDA', 'ARQUIVADA', 'CANCELADA')),
          origem_uf TEXT NOT NULL DEFAULT 'BA',
          prioridade INTEGER NOT NULL DEFAULT 100,
          observacoes TEXT,
          importacao_id TEXT,
          criado_por_usuario_id TEXT REFERENCES users(id),
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (transportadora_id, servico_transportadora_id, codigo, versao)
        );
        CREATE INDEX IF NOT EXISTS idx_tabelas_tarifa_status ON tabelas_tarifa(status, data_fim_vigencia);
        CREATE INDEX IF NOT EXISTS idx_tabelas_tarifa_escopo ON tabelas_tarifa(transportadora_id, servico_transportadora_id, origem_uf);

        CREATE TABLE IF NOT EXISTS faixas_tarifa (
          id TEXT PRIMARY KEY,
          tabela_tarifa_id TEXT NOT NULL REFERENCES tabelas_tarifa(id),
          uf_origem TEXT NOT NULL,
          uf_destino TEXT NOT NULL,
          cep_inicio TEXT NOT NULL CHECK (length(cep_inicio) = 8),
          cep_fim TEXT NOT NULL CHECK (length(cep_fim) = 8 AND cep_fim >= cep_inicio),
          peso_minimo_kg REAL NOT NULL DEFAULT 0 CHECK (peso_minimo_kg >= 0),
          peso_maximo_kg REAL NOT NULL CHECK (peso_maximo_kg >= peso_minimo_kg),
          valor_minimo_pedido_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_minimo_pedido_centavos >= 0),
          valor_maximo_pedido_centavos INTEGER NOT NULL DEFAULT 999999999 CHECK (valor_maximo_pedido_centavos >= valor_minimo_pedido_centavos),
          quantidade_volumes_minima INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_volumes_minima >= 1),
          quantidade_volumes_maxima INTEGER NOT NULL DEFAULT 999 CHECK (quantidade_volumes_maxima >= quantidade_volumes_minima),
          valor_frete_base_centavos INTEGER NOT NULL CHECK (valor_frete_base_centavos >= 0),
          valor_por_kg_excedente_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_por_kg_excedente_centavos >= 0),
          frete_minimo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (frete_minimo_centavos >= 0),
          prazo_dias INTEGER NOT NULL CHECK (prazo_dias >= 0),
          ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_faixas_tarifa_busca ON faixas_tarifa(tabela_tarifa_id, uf_destino, cep_inicio, cep_fim, peso_minimo_kg, peso_maximo_kg, ativo);

        CREATE TABLE IF NOT EXISTS regras_adicionais_tarifa (
          id TEXT PRIMARY KEY,
          tabela_tarifa_id TEXT NOT NULL REFERENCES tabelas_tarifa(id),
          faixa_tarifa_id TEXT REFERENCES faixas_tarifa(id),
          tipo_regra TEXT NOT NULL,
          nome TEXT NOT NULL,
          prioridade INTEGER NOT NULL DEFAULT 100,
          percentual TEXT,
          valor_fixo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_fixo_centavos >= 0),
          valor_minimo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_minimo_centavos >= 0),
          valor_maximo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_maximo_centavos >= 0),
          condicao_json TEXT NOT NULL DEFAULT '{}',
          ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_regras_tarifa_prioridade ON regras_adicionais_tarifa(tabela_tarifa_id, faixa_tarifa_id, prioridade, ativo);

        CREATE TABLE IF NOT EXISTS canais_venda (
          id TEXT PRIMARY KEY,
          codigo TEXT NOT NULL UNIQUE,
          nome TEXT NOT NULL,
          ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS enderecos (
          id TEXT PRIMARY KEY,
          cep TEXT NOT NULL CHECK (length(cep) = 8),
          logradouro TEXT,
          numero TEXT,
          complemento TEXT,
          bairro TEXT,
          cidade TEXT NOT NULL,
          uf TEXT NOT NULL,
          pais TEXT NOT NULL DEFAULT 'BR',
          latitude TEXT,
          longitude TEXT,
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_enderecos_cep ON enderecos(cep);

        CREATE TABLE IF NOT EXISTS volumes_pedido (
          id TEXT PRIMARY KEY,
          pedido_id TEXT NOT NULL REFERENCES orders(id),
          descricao TEXT,
          quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade >= 1),
          peso_real_kg REAL NOT NULL CHECK (peso_real_kg > 0),
          comprimento_cm REAL NOT NULL CHECK (comprimento_cm > 0),
          largura_cm REAL NOT NULL CHECK (largura_cm > 0),
          altura_cm REAL NOT NULL CHECK (altura_cm > 0),
          peso_cubado_kg REAL NOT NULL DEFAULT 0,
          peso_considerado_kg REAL NOT NULL DEFAULT 0,
          valor_declarado_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_declarado_centavos >= 0),
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_volumes_pedido ON volumes_pedido(pedido_id);

        CREATE TABLE IF NOT EXISTS fretes_selecionados (
          id TEXT PRIMARY KEY,
          pedido_id TEXT NOT NULL REFERENCES orders(id),
          cotacao_id TEXT NOT NULL REFERENCES quotes(id),
          cotacao_opcao_id TEXT NOT NULL REFERENCES quote_options(id),
          transportadora_id TEXT NOT NULL REFERENCES carriers(id),
          servico_transportadora_id TEXT REFERENCES servicos_transportadora(id),
          valor_frete_centavos INTEGER NOT NULL CHECK (valor_frete_centavos >= 0),
          prazo_dias INTEGER NOT NULL CHECK (prazo_dias >= 0),
          motivo_selecao TEXT NOT NULL,
          selecionado_automaticamente INTEGER NOT NULL DEFAULT 0 CHECK (selecionado_automaticamente IN (0, 1)),
          aprovado_por_usuario_id TEXT REFERENCES users(id),
          aprovado_em TEXT,
          status TEXT NOT NULL CHECK (status IN ('SELECIONADO', 'APROVADO', 'REJEITADO', 'ENVIADO_ERP', 'CANCELADO')),
          observacoes TEXT,
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_frete_ativo_por_pedido ON fretes_selecionados(pedido_id) WHERE status IN ('SELECIONADO', 'APROVADO', 'ENVIADO_ERP');

        CREATE TABLE IF NOT EXISTS integracoes (
          id TEXT PRIMARY KEY,
          codigo TEXT NOT NULL UNIQUE,
          nome TEXT NOT NULL,
          tipo TEXT NOT NULL,
          ambiente TEXT NOT NULL DEFAULT 'DESENVOLVIMENTO',
          base_url TEXT,
          autenticacao_tipo TEXT,
          configuracao_criptografada TEXT NOT NULL DEFAULT '{}',
          ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
          ultimo_teste_em TEXT,
          ultimo_status_teste TEXT,
          ultima_mensagem_teste TEXT,
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS logs_integracao (
          id TEXT PRIMARY KEY,
          integracao_id TEXT NOT NULL REFERENCES integracoes(id),
          pedido_id TEXT REFERENCES orders(id),
          frete_selecionado_id TEXT REFERENCES fretes_selecionados(id),
          tipo_evento TEXT NOT NULL,
          direcao TEXT NOT NULL CHECK (direcao IN ('ENTRADA', 'SAIDA')),
          status TEXT NOT NULL CHECK (status IN ('PENDENTE', 'PROCESSANDO', 'SUCESSO', 'ERRO', 'AGUARDANDO_REPROCESSAMENTO', 'CANCELADO')),
          tentativas INTEGER NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
          proxima_tentativa_em TEXT,
          request_resumido_json TEXT NOT NULL DEFAULT '{}',
          response_resumido_json TEXT NOT NULL DEFAULT '{}',
          codigo_http INTEGER,
          mensagem TEXT,
          codigo_erro TEXT,
          correlation_id TEXT,
          iniciado_em TEXT,
          finalizado_em TEXT,
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_logs_integracao_fila ON logs_integracao(integracao_id, status, criado_em);

        CREATE TABLE IF NOT EXISTS importacoes (
          id TEXT PRIMARY KEY,
          tipo TEXT NOT NULL,
          nome_arquivo TEXT NOT NULL,
          hash_arquivo TEXT NOT NULL UNIQUE,
          tamanho_arquivo_bytes INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          total_linhas INTEGER NOT NULL DEFAULT 0,
          linhas_validas INTEGER NOT NULL DEFAULT 0,
          linhas_com_erro INTEGER NOT NULL DEFAULT 0,
          usuario_id TEXT REFERENCES users(id),
          iniciado_em TEXT,
          finalizado_em TEXT,
          detalhes_json TEXT NOT NULL DEFAULT '{}',
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_importacoes_status ON importacoes(tipo, status, criado_em);

        CREATE TABLE IF NOT EXISTS linhas_importacao (
          id TEXT PRIMARY KEY,
          importacao_id TEXT NOT NULL REFERENCES importacoes(id),
          numero_linha INTEGER NOT NULL,
          status TEXT NOT NULL,
          dados_json TEXT NOT NULL DEFAULT '{}',
          erros_json TEXT NOT NULL DEFAULT '[]',
          avisos_json TEXT NOT NULL DEFAULT '[]',
          entidade_criada TEXT,
          entidade_id TEXT,
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_linhas_importacao ON linhas_importacao(importacao_id, status, numero_linha);

        CREATE TABLE IF NOT EXISTS historico_status_pedido (
          id TEXT PRIMARY KEY,
          pedido_id TEXT NOT NULL REFERENCES orders(id),
          tipo_status TEXT NOT NULL CHECK (tipo_status IN ('PEDIDO', 'COTACAO', 'INTEGRACAO', 'LOGISTICO')),
          status_anterior TEXT,
          status_novo TEXT NOT NULL,
          motivo TEXT,
          usuario_id TEXT REFERENCES users(id),
          origem TEXT NOT NULL DEFAULT 'SISTEMA',
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_historico_status_pedido ON historico_status_pedido(pedido_id, tipo_status, criado_em);
        """,
    ),
    (
        "20260705_001_rentabilidade_marketplace",
        """
        CREATE TABLE IF NOT EXISTS marketplace_premissas (
          id TEXT PRIMARY KEY,
          codigo TEXT NOT NULL UNIQUE,
          nome TEXT NOT NULL,
          comissao_percentual TEXT NOT NULL DEFAULT '0',
          taxa_fixa_centavos INTEGER NOT NULL DEFAULT 0 CHECK (taxa_fixa_centavos >= 0),
          imposto_percentual TEXT NOT NULL DEFAULT '0',
          ads_percentual TEXT NOT NULL DEFAULT '0',
          parcelamento_percentual TEXT NOT NULL DEFAULT '0',
          frete_gratis_minimo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (frete_gratis_minimo_centavos >= 0),
          margem_alvo_percentual TEXT NOT NULL DEFAULT '0.15',
          ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS marketplace_skus (
          id TEXT PRIMARY KEY,
          sku TEXT NOT NULL,
          nome TEXT NOT NULL,
          canal TEXT NOT NULL,
          custo_produto_centavos INTEGER NOT NULL DEFAULT 0 CHECK (custo_produto_centavos >= 0),
          preco_venda_centavos INTEGER NOT NULL DEFAULT 0 CHECK (preco_venda_centavos >= 0),
          custo_embalagem_centavos INTEGER NOT NULL DEFAULT 0 CHECK (custo_embalagem_centavos >= 0),
          imposto_percentual TEXT,
          comissao_percentual TEXT,
          ads_percentual TEXT,
          parcelamento_percentual TEXT,
          frete_estimado_centavos INTEGER NOT NULL DEFAULT 0 CHECK (frete_estimado_centavos >= 0),
          frete_gratis INTEGER NOT NULL DEFAULT 0 CHECK (frete_gratis IN (0, 1)),
          peso_kg REAL NOT NULL DEFAULT 0 CHECK (peso_kg >= 0),
          comprimento_cm REAL NOT NULL DEFAULT 0 CHECK (comprimento_cm >= 0),
          largura_cm REAL NOT NULL DEFAULT 0 CHECK (largura_cm >= 0),
          altura_cm REAL NOT NULL DEFAULT 0 CHECK (altura_cm >= 0),
          fator_cubagem REAL NOT NULL DEFAULT 300 CHECK (fator_cubagem > 0),
          estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
          status TEXT NOT NULL DEFAULT 'ATIVO',
          atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (sku, canal)
        );
        CREATE INDEX IF NOT EXISTS idx_marketplace_skus_canal ON marketplace_skus(canal, status);

        CREATE TABLE IF NOT EXISTS rentabilidade_snapshots (
          id TEXT PRIMARY KEY,
          sku_id TEXT NOT NULL REFERENCES marketplace_skus(id),
          usuario_id TEXT REFERENCES users(id),
          resultado_json TEXT NOT NULL,
          criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_rentabilidade_snapshots_sku ON rentabilidade_snapshots(sku_id, criado_em);
        """,
    )
]


USER_COLUMNS = {
    "telefone": "TEXT",
    "ativo": "INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))",
    "ultimo_login_em": "TEXT",
    "atualizado_em": "TEXT",
    "excluido_em": "TEXT",
}

CHANNEL_COLUMNS = {
    "client_id": "TEXT",
    "client_secret": "TEXT",
    "frequencia_min": "INTEGER NOT NULL DEFAULT 5",
    "ultima_sincronizacao": "TEXT",
}


def apply_migrations(conn):
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    applied = {row["version"] for row in conn.execute("SELECT version FROM schema_migrations").fetchall()}
    for version, sql in MIGRATIONS:
        if version in applied:
            continue
        conn.executescript(sql)
        conn.execute("INSERT INTO schema_migrations (version) VALUES (?)", (version,))
    ensure_user_columns(conn)
    ensure_channel_columns(conn)
    seed_expanded_model(conn)


def ensure_user_columns(conn):
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    for column, definition in USER_COLUMNS.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE users ADD COLUMN {column} {definition}")
    conn.execute(
        """
        INSERT OR IGNORE INTO schema_migrations (version)
        VALUES ('20260704_002_usuarios_operacionais')
        """
    )
    conn.execute(
        """
        UPDATE users
        SET ativo = COALESCE(ativo, 1),
            atualizado_em = COALESCE(atualizado_em, created_at)
        """
    )


def ensure_channel_columns(conn):
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(canais_venda)").fetchall()}
    for column, definition in CHANNEL_COLUMNS.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE canais_venda ADD COLUMN {column} {definition}")
    conn.execute(
        """
        INSERT OR IGNORE INTO schema_migrations (version)
        VALUES ('20260704_003_configuracao_canais')
        """
    )
    defaults = {
        "MERCADO_LIVRE": ("ML_APP_1234", "ml-secret-demo", 10, "2026-07-04T16:53:19", 1),
        "SHOPEE": ("SHOPEE_PARTNER_9876", "shopee-secret-demo", 15, "2026-07-04T23:17:45", 1),
        "SITE_PROPRIO": ("SITE_API_KEY_DEMO", "site-secret-demo", 5, "2026-07-04T16:23:19", 1),
    }
    for code, values in defaults.items():
        conn.execute(
            """
            UPDATE canais_venda
            SET client_id = COALESCE(client_id, ?),
                client_secret = COALESCE(client_secret, ?),
                frequencia_min = COALESCE(frequencia_min, ?),
                ultima_sincronizacao = COALESCE(ultima_sincronizacao, ?),
                ativo = ?
            WHERE codigo = ?
            """,
            (*values, code),
        )


def seed_expanded_model(conn):
    if conn.execute("SELECT COUNT(*) FROM perfis").fetchone()[0] == 0:
        profiles = [
            ("perfil-admin", "ADMINISTRADOR", "Administrador", "Acesso total"),
            ("perfil-gestor", "GESTOR_LOGISTICA", "Gestor de Logistica", "Gestao operacional de fretes"),
            ("perfil-operador", "OPERADOR_FRETE", "Operador de Frete", "Operacao de cotacoes"),
            ("perfil-financeiro", "FINANCEIRO", "Financeiro", "Consulta de custos"),
            ("perfil-consulta", "CONSULTA", "Consulta", "Acesso somente leitura"),
        ]
        conn.executemany("INSERT INTO perfis (id, codigo, nome, descricao) VALUES (?, ?, ?, ?)", profiles)

    profile_by_legacy = {
        "Administrador": "perfil-admin",
        "Gestor de Logistica": "perfil-gestor",
        "Operador de Frete": "perfil-operador",
        "Financeiro": "perfil-financeiro",
        "Consulta": "perfil-consulta",
    }
    for user in conn.execute("SELECT id, perfil FROM users").fetchall():
        perfil_id = profile_by_legacy.get(user["perfil"], "perfil-consulta")
        conn.execute(
            "INSERT OR IGNORE INTO usuario_perfis (id, usuario_id, perfil_id) VALUES (?, ?, ?)",
            (f"up-{user['id']}-{perfil_id}", user["id"], perfil_id),
        )

    if conn.execute("SELECT COUNT(*) FROM canais_venda").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO canais_venda (id, codigo, nome) VALUES (?, ?, ?)",
            [
                ("canal-ml", "MERCADO_LIVRE", "Mercado Livre"),
                ("canal-shopee", "SHOPEE", "Shopee"),
                ("canal-site", "SITE_PROPRIO", "Site Proprio"),
                ("canal-loja", "LOJA_FISICA", "Loja Fisica"),
                ("canal-manual", "MANUAL", "Manual"),
            ],
        )

    if conn.execute("SELECT COUNT(*) FROM servicos_transportadora").fetchone()[0] == 0:
        services = []
        for carrier in conn.execute("SELECT id, nome_fantasia, fator_cubagem FROM carriers").fetchall():
            services.append((f"svc-{carrier['id']}-normal", carrier["id"], "NORMAL", f"{carrier['nome_fantasia']} Normal", "NORMAL", 5, carrier["fator_cubagem"], 0, 100))
            services.append((f"svc-{carrier['id']}-expresso", carrier["id"], "EXPRESSO", f"{carrier['nome_fantasia']} Expresso", "EXPRESSO", 3, carrier["fator_cubagem"], 0, 60))
        conn.executemany(
            """
            INSERT INTO servicos_transportadora
            (id, transportadora_id, codigo, nome, modalidade, prazo_base_dias, fator_cubagem, peso_minimo_kg, peso_maximo_kg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            services,
        )

    today = date.today()
    if conn.execute("SELECT COUNT(*) FROM contratos_transportadora").fetchone()[0] == 0:
        for carrier in conn.execute("SELECT id, nome_fantasia, contrato FROM carriers").fetchall():
            conn.execute(
                """
                INSERT INTO contratos_transportadora
                (id, transportadora_id, numero_contrato, descricao, data_inicio, data_fim, status, responsavel, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"ctr-{carrier['id']}-ativo",
                    carrier["id"],
                    carrier["contrato"] or f"CTR-{carrier['id']}",
                    f"Contrato operacional {carrier['nome_fantasia']}",
                    (today - timedelta(days=60)).isoformat(),
                    (today + timedelta(days=120)).isoformat(),
                    "ATIVO",
                    "Gestor Logistica",
                    "Seed V2",
                ),
            )

    if conn.execute("SELECT COUNT(*) FROM tabelas_tarifa").fetchone()[0] == 0:
        for rate in conn.execute("SELECT * FROM rates").fetchall():
            service = conn.execute(
                "SELECT id FROM servicos_transportadora WHERE transportadora_id = ? ORDER BY codigo LIMIT 1",
                (rate["transportadora_id"],),
            ).fetchone()
            contract = conn.execute(
                "SELECT id FROM contratos_transportadora WHERE transportadora_id = ? AND status = 'ATIVO' LIMIT 1",
                (rate["transportadora_id"],),
            ).fetchone()
            if not service or not contract:
                continue
            table_id = f"tab-{rate['id']}"
            conn.execute(
                """
                INSERT INTO tabelas_tarifa
                (id, transportadora_id, contrato_id, servico_transportadora_id, codigo, nome, versao, data_inicio_vigencia,
                 data_fim_vigencia, status, origem_uf, prioridade, observacoes, criado_por_usuario_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    table_id,
                    rate["transportadora_id"],
                    contract["id"],
                    service["id"],
                    rate["id"].upper(),
                    rate["nome"],
                    1,
                    rate["vigencia_inicio"],
                    rate["vigencia_fim"],
                    "ATIVA" if rate["status"] == "Ativa" else "VENCIDA",
                    rate["uf_origem"],
                    100,
                    rate["regras_adicionais"],
                    "u1",
                ),
            )
            faixa_id = f"fx-{rate['id']}"
            conn.execute(
                """
                INSERT INTO faixas_tarifa
                (id, tabela_tarifa_id, uf_origem, uf_destino, cep_inicio, cep_fim, peso_minimo_kg, peso_maximo_kg,
                 valor_frete_base_centavos, valor_por_kg_excedente_centavos, frete_minimo_centavos, prazo_dias)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    faixa_id,
                    table_id,
                    rate["uf_origem"],
                    rate["uf_destino"],
                    rate["cep_inicio"],
                    rate["cep_fim"],
                    rate["peso_inicio_kg"],
                    rate["peso_fim_kg"],
                    money_to_cents(rate["taxa_fixa"]),
                    money_to_cents(rate["kg_excedente"]),
                    money_to_cents(rate["minimo_frete"]),
                    rate["prazo_dias"],
                ),
            )
            rules = [
                ("AD_VALOREM", "Ad valorem", "0.0015", 0),
                ("GRIS", "GRIS", str(rate["risco_percentual"]), 0),
                ("PEDAGIO", "Pedagio", None, money_to_cents(rate["pedagio_valor"])),
            ]
            for index, (tipo, nome, percentual, fixo) in enumerate(rules, start=1):
                conn.execute(
                    """
                    INSERT INTO regras_adicionais_tarifa
                    (id, tabela_tarifa_id, faixa_tarifa_id, tipo_regra, nome, prioridade, percentual, valor_fixo_centavos)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (f"reg-{rate['id']}-{tipo.lower()}", table_id, faixa_id, tipo, nome, index, percentual, fixo),
                )

    if conn.execute("SELECT COUNT(*) FROM volumes_pedido").fetchone()[0] == 0:
        for order in conn.execute("SELECT * FROM orders LIMIT 50").fetchall():
            fator = 300
            peso_cubado = (order["comprimento_cm"] * order["largura_cm"] * order["altura_cm"] * order["volumes"]) / fator
            peso_real_total = order["peso_real_kg"] * order["volumes"]
            conn.execute(
                """
                INSERT INTO volumes_pedido
                (id, pedido_id, descricao, quantidade, peso_real_kg, comprimento_cm, largura_cm, altura_cm,
                 peso_cubado_kg, peso_considerado_kg, valor_declarado_centavos)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"vol-{order['id']}",
                    order["id"],
                    order["produtos"],
                    order["volumes"],
                    order["peso_real_kg"],
                    order["comprimento_cm"],
                    order["largura_cm"],
                    order["altura_cm"],
                    round(peso_cubado, 2),
                    round(max(peso_real_total, peso_cubado), 2),
                    money_to_cents(order["valor_pedido"]),
                ),
            )

    if conn.execute("SELECT COUNT(*) FROM integracoes").fetchone()[0] == 0:
        conn.executemany(
            """
            INSERT INTO integracoes (id, codigo, nome, tipo, ambiente, ativo, ultimo_status_teste, ultima_mensagem_teste)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("int-protheus", "PROTHEUS", "Protheus", "ERP", "HOMOLOGACAO", 1, "NAO_CONFIGURADO", "Credenciais pendentes."),
                ("int-ml", "MERCADO_LIVRE", "Mercado Livre", "MARKETPLACE", "DESENVOLVIMENTO", 1, "SIMULADO", "Modo simulado ativo."),
                ("int-shopee", "SHOPEE", "Shopee", "MARKETPLACE", "DESENVOLVIMENTO", 1, "SIMULADO", "Modo simulado ativo."),
            ],
        )
        conn.executemany(
            """
            INSERT INTO logs_integracao
            (id, integracao_id, pedido_id, tipo_evento, direcao, status, tentativas, mensagem, correlation_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("log-int-1", "int-protheus", "p1", "ENVIO_FRETE", "SAIDA", "PENDENTE", 0, "Frete aguardando envio ao ERP.", "corr-demo-1"),
                ("log-int-2", "int-ml", "p2", "IMPORTACAO_PEDIDO", "ENTRADA", "SUCESSO", 1, "Pedido recebido em modo simulado.", "corr-demo-2"),
                ("log-int-3", "int-shopee", "p3", "IMPORTACAO_PEDIDO", "ENTRADA", "ERRO", 2, "Erro simulado para demonstracao.", "corr-demo-3"),
            ],
        )

    if conn.execute("SELECT COUNT(*) FROM importacoes").fetchone()[0] == 0:
        import_rows = [
            ("imp-ok", "PEDIDOS", "pedidos-demo.xlsx", "hash-demo-ok", 2048, "CONCLUIDO", 20, 20, 0, "u1", "{}"),
            ("imp-erro", "TARIFAS", "tarifas-com-erros.xlsx", "hash-demo-erro", 1024, "COM_ERROS", 5, 3, 2, "u2", json.dumps({"erro": "Duas linhas invalidas"})),
        ]
        conn.executemany(
            """
            INSERT INTO importacoes
            (id, tipo, nome_arquivo, hash_arquivo, tamanho_arquivo_bytes, status, total_linhas, linhas_validas,
             linhas_com_erro, usuario_id, detalhes_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            import_rows,
        )
        conn.executemany(
            """
            INSERT INTO linhas_importacao
            (id, importacao_id, numero_linha, status, dados_json, erros_json, avisos_json, entidade_criada, entidade_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("lin-imp-1", "imp-ok", 2, "IMPORTADA", json.dumps({"numero": "SC-100001"}), "[]", "[]", "orders", "p1"),
                ("lin-imp-2", "imp-erro", 3, "INVALIDA", json.dumps({"cep_inicio": "ABC"}), json.dumps(["CEP invalido"]), "[]", None, None),
            ],
        )

    if conn.execute("SELECT COUNT(*) FROM historico_status_pedido").fetchone()[0] == 0:
        for order in conn.execute("SELECT id, status FROM orders LIMIT 20").fetchall():
            conn.execute(
                """
                INSERT INTO historico_status_pedido
                (id, pedido_id, tipo_status, status_anterior, status_novo, motivo, usuario_id, origem)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (f"hist-{order['id']}", order["id"], "PEDIDO", None, order["status"], "Seed inicial V2", "u1", "SISTEMA"),
            )

    if conn.execute("SELECT COUNT(*) FROM marketplace_premissas").fetchone()[0] == 0:
        conn.executemany(
            """
            INSERT INTO marketplace_premissas
            (id, codigo, nome, comissao_percentual, taxa_fixa_centavos, imposto_percentual, ads_percentual,
             parcelamento_percentual, frete_gratis_minimo_centavos, margem_alvo_percentual)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("prem-ml", "MERCADO_LIVRE", "Mercado Livre", "0.16", money_to_cents(6.0), "0.08", "0.04", "0.02", money_to_cents(79), "0.15"),
                ("prem-shopee", "SHOPEE", "Shopee", "0.14", money_to_cents(4.0), "0.08", "0.05", "0.015", money_to_cents(39), "0.15"),
                ("prem-site", "SITE_PROPRIO", "Loja Propria", "0.04", money_to_cents(1.5), "0.08", "0.03", "0.0", money_to_cents(199), "0.18"),
            ],
        )

    if conn.execute("SELECT COUNT(*) FROM marketplace_skus").fetchone()[0] == 0:
        conn.executemany(
            """
            INSERT INTO marketplace_skus
            (id, sku, nome, canal, custo_produto_centavos, preco_venda_centavos, custo_embalagem_centavos,
             frete_estimado_centavos, frete_gratis, peso_kg, comprimento_cm, largura_cm, altura_cm, fator_cubagem,
             estoque, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("sku-rent-1", "SC-KIT-001", "Kit organizador compacto", "MERCADO_LIVRE", money_to_cents(42), money_to_cents(89.9), money_to_cents(2.8), money_to_cents(19.9), 1, 0.8, 24, 18, 12, 300, 34, "ATIVO"),
                ("sku-rent-2", "SC-CAIXA-012", "Caixa plastica alta cubagem", "MERCADO_LIVRE", money_to_cents(58), money_to_cents(109.9), money_to_cents(4.5), money_to_cents(38.5), 1, 1.2, 46, 36, 31, 300, 12, "ATIVO"),
                ("sku-rent-3", "SC-UTIL-220", "Utensilio domestico leve", "SHOPEE", money_to_cents(18), money_to_cents(39.9), money_to_cents(1.5), money_to_cents(11.9), 0, 0.25, 18, 12, 8, 300, 80, "ATIVO"),
                ("sku-rent-4", "SC-PRO-078", "Produto profissional medio", "SITE_PROPRIO", money_to_cents(120), money_to_cents(229.9), money_to_cents(5.5), money_to_cents(32.0), 1, 2.4, 34, 28, 20, 300, 9, "ATIVO"),
                ("sku-rent-5", "SC-PROMO-010", "Produto promocional margem apertada", "SHOPEE", money_to_cents(31), money_to_cents(49.9), money_to_cents(2.2), money_to_cents(16.9), 1, 0.55, 22, 18, 15, 300, 45, "ATIVO"),
            ],
        )


def money_to_cents(value):
    return int(round(float(value or 0) * 100))


def cents_to_money(value):
    return round(int(value or 0) / 100, 2)
