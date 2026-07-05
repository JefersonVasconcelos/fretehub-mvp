import json
import os
import sqlite3
from datetime import date, timedelta

from fretehub.auth import hash_password
from fretehub.migrations import apply_migrations


ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(ROOT_DIR, "data")
DB_PATH = os.environ.get("FRETEHUB_DB", os.path.join(DATA_DIR, "fretehub.sqlite"))


def connect():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              nome TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              perfil TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'Ativo',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS carriers (
              id TEXT PRIMARY KEY,
              nome_fantasia TEXT NOT NULL,
              razao_social TEXT NOT NULL,
              cnpj TEXT,
              status TEXT NOT NULL,
              fator_cubagem REAL NOT NULL,
              modalidades_json TEXT NOT NULL,
              estados_json TEXT NOT NULL,
              prazo_medio_dias INTEGER NOT NULL,
              contrato TEXT,
              observacoes TEXT
            );

            CREATE TABLE IF NOT EXISTS rates (
              id TEXT PRIMARY KEY,
              nome TEXT NOT NULL,
              transportadora_id TEXT NOT NULL REFERENCES carriers(id),
              modalidade TEXT NOT NULL,
              uf_origem TEXT NOT NULL,
              uf_destino TEXT NOT NULL,
              cep_inicio TEXT NOT NULL,
              cep_fim TEXT NOT NULL,
              peso_inicio_kg REAL NOT NULL,
              peso_fim_kg REAL NOT NULL,
              taxa_fixa REAL NOT NULL,
              kg_excedente REAL NOT NULL,
              combustivel_percentual REAL NOT NULL,
              risco_percentual REAL NOT NULL,
              interior_valor REAL NOT NULL,
              pedagio_valor REAL NOT NULL,
              seguro_percentual REAL NOT NULL,
              prazo_dias INTEGER NOT NULL,
              minimo_frete REAL NOT NULL,
              maximo_frete REAL NOT NULL,
              status TEXT NOT NULL,
              vigencia_inicio TEXT NOT NULL,
              vigencia_fim TEXT NOT NULL,
              regras_adicionais TEXT
            );

            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              numero TEXT NOT NULL UNIQUE,
              canal TEXT NOT NULL,
              cliente TEXT NOT NULL,
              cep_origem TEXT NOT NULL,
              cep_destino TEXT NOT NULL,
              cidade_destino TEXT,
              uf_destino TEXT NOT NULL,
              valor_pedido REAL NOT NULL,
              peso_real_kg REAL NOT NULL,
              comprimento_cm REAL NOT NULL,
              largura_cm REAL NOT NULL,
              altura_cm REAL NOT NULL,
              volumes INTEGER NOT NULL,
              produtos TEXT,
              status TEXT NOT NULL,
              transportadora_selecionada_id TEXT,
              modalidade_selecionada TEXT,
              frete_calculado REAL DEFAULT 0,
              frete_cobrado REAL DEFAULT 0,
              prazo_dias INTEGER DEFAULT 0,
              status_protheus TEXT DEFAULT 'Pendente',
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS quotes (
              id TEXT PRIMARY KEY,
              pedido_id TEXT NOT NULL REFERENCES orders(id),
              usuario_id TEXT NOT NULL REFERENCES users(id),
              status TEXT NOT NULL,
              prioridade TEXT NOT NULL,
              params_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS quote_options (
              id TEXT PRIMARY KEY,
              cotacao_id TEXT NOT NULL REFERENCES quotes(id),
              data_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audits (
              id TEXT PRIMARY KEY,
              usuario_id TEXT,
              usuario_nome TEXT,
              acao TEXT NOT NULL,
              entidade TEXT NOT NULL,
              entidade_id TEXT,
              detalhe TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS integration_configs (
              id TEXT PRIMARY KEY,
              nome TEXT NOT NULL,
              tipo TEXT NOT NULL,
              status TEXT NOT NULL,
              base_url TEXT,
              credentials_json TEXT NOT NULL DEFAULT '{}',
              last_check_at TEXT,
              last_message TEXT
            );
            """
        )
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            seed(conn)
        apply_migrations(conn)


def seed(conn):
    users = [
        ("u1", "Ana Ribeiro", "admin@salvadorcomercial.com.br", "Administrador"),
        ("u2", "Carlos Mendes", "gestor@salvadorcomercial.com.br", "Gestor de Logistica"),
        ("u3", "Fernanda Lima", "operador@salvadorcomercial.com.br", "Operador de Frete"),
        ("u4", "Roberto Souza", "financeiro@salvadorcomercial.com.br", "Financeiro"),
        ("u5", "Juliana Alves", "consulta@salvadorcomercial.com.br", "Consulta"),
    ]
    for user in users:
        conn.execute(
            "INSERT INTO users (id, nome, email, perfil, password_hash) VALUES (?, ?, ?, ?, ?)",
            (*user, hash_password("Admin123!")),
        )

    carriers = [
        ("t1", "Vale Sul", "Transportadora Vale Sul LTDA", "12.345.678/0001-90", "Ativa", 300, ["Rodoviario", "Fracionado"], ["BA", "SP", "PR", "SC", "RS"], 5, "CTR-2026-001", "Principal para Sul e Sudeste."),
        ("t2", "Expresso Gaucho", "Expresso Gaucho Logistica SA", "23.456.789/0001-11", "Ativa", 250, ["Rodoviario", "Expresso"], ["RS", "SC", "PR", "SP"], 4, "CTR-2026-002", "Melhor prazo para regiao Sul."),
        ("t3", "Rota Certa", "Rota Certa Transportes LTDA", "34.567.890/0001-22", "Ativa", 167, ["Rodoviario", "Fracionado"], ["BA", "SP", "RJ", "MG", "PR", "SC", "RS"], 7, "CTR-2026-003", "Cobertura ampla, custo maior."),
        ("t4", "Nordeste Cargas", "Nordeste Cargas Expressas LTDA", "45.678.901/0001-33", "Inativa", 300, ["Fracionado"], ["BA", "SE", "PE", "AL", "CE"], 3, "CTR-2026-004", "Contrato aguardando renovacao."),
    ]
    for c in carriers:
        conn.execute(
            """
            INSERT INTO carriers
            (id, nome_fantasia, razao_social, cnpj, status, fator_cubagem, modalidades_json, estados_json, prazo_medio_dias, contrato, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (c[0], c[1], c[2], c[3], c[4], c[5], json.dumps(c[6]), json.dumps(c[7]), c[8], c[9], c[10]),
        )

    today = date.today()
    rates = [
        ("tar1", "Vale Sul - Fracionado SP", "t1", "Fracionado", "SP", "01000000", "19999999", 0, 80, 22, 2.1, 0.14, 0.003, 12, 9, 0.0015, 5, 45, 900, "Ativa", -60, 90),
        ("tar2", "Expresso Gaucho - RS Expresso", "t2", "Expresso", "RS", "90000000", "99999999", 0, 60, 28, 2.35, 0.16, 0.0035, 10, 14, 0.0018, 4, 55, 1100, "Ativa", -30, 60),
        ("tar3", "Rota Certa - RJ Rodoviario", "t3", "Rodoviario", "RJ", "20000000", "28999999", 0, 100, 30, 2.55, 0.18, 0.004, 8, 16, 0.002, 6, 60, 1300, "Ativa", -10, 120),
        ("tar4", "Vale Sul - Parana vencida", "t1", "Rodoviario", "PR", "80000000", "87999999", 0, 70, 24, 2.0, 0.13, 0.0025, 8, 10, 0.0012, 5, 42, 850, "Vencida", -200, -15),
    ]
    for r in rates:
        conn.execute(
            """
            INSERT INTO rates
            (id, nome, transportadora_id, modalidade, uf_origem, uf_destino, cep_inicio, cep_fim, peso_inicio_kg, peso_fim_kg, taxa_fixa,
             kg_excedente, combustivel_percentual, risco_percentual, interior_valor, pedagio_valor, seguro_percentual, prazo_dias,
             minimo_frete, maximo_frete, status, vigencia_inicio, vigencia_fim, regras_adicionais)
            VALUES (?, ?, ?, ?, 'BA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (*r[:4], r[4], *r[5:20], (today + timedelta(days=r[20])).isoformat(), (today + timedelta(days=r[21])).isoformat(), "Tabela demonstrativa V2."),
        )

    channels = ["Mercado Livre", "Shopee", "Site Proprio"]
    customers = ["Joao da Silva", "Maria Souza", "Pedro Almeida", "Aline Barreto", "Lucas Ferreira", "Camila Duarte"]
    ufs = ["SP", "RS", "RJ", "PR", "MG", "BA", "SC"]
    cep_base = {"SP": "01310", "RS": "90010", "RJ": "20040", "PR": "80010", "MG": "30110", "BA": "40010", "SC": "88010"}
    statuses = ["Novo", "Aguardando Cotacao", "Frete Definido", "Enviado ao Protheus", "Em Expedicao", "Entregue", "Erro de Integracao"]
    for i in range(50):
        uf = ufs[i % len(ufs)]
        status = statuses[(i * 3) % len(statuses)]
        has_freight = status in {"Frete Definido", "Enviado ao Protheus", "Em Expedicao", "Entregue"}
        conn.execute(
            """
            INSERT INTO orders
            (id, numero, canal, cliente, cep_origem, cep_destino, cidade_destino, uf_destino, valor_pedido, peso_real_kg,
             comprimento_cm, largura_cm, altura_cm, volumes, produtos, status, transportadora_selecionada_id,
             modalidade_selecionada, frete_calculado, frete_cobrado, prazo_dias, status_protheus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"p{i + 1}",
                f"SC-{100000 + i}",
                channels[i % len(channels)],
                customers[i % len(customers)],
                "40010000",
                f"{cep_base[uf]}{str((i * 17) % 900).zfill(3)}",
                "Capital",
                uf,
                120 + ((i * 43) % 900),
                round(0.5 + ((i * 7) % 35) * 0.55, 2),
                22 + (i % 40),
                16 + (i % 25),
                10 + (i % 30),
                1 + (1 if i % 3 == 0 else 0),
                ["Eletronico compacto", "Utensilios cozinha", "Ferramenta manual", "Kit escritorio"][i % 4],
                status,
                ["t1", "t2", "t3"][i % 3] if has_freight else "",
                "Fracionado" if has_freight and i % 2 else "Rodoviario" if has_freight else "",
                round(45 + ((i * 11) % 120), 2) if has_freight else 0,
                round(48 + ((i * 9) % 125), 2) if has_freight else 0,
                3 + (i % 5) if has_freight else 0,
                "Erro" if status == "Erro de Integracao" else "Enviado" if has_freight else "Pendente",
            ),
        )

    for item in [
        ("protheus", "Protheus", "ERP", "Nao configurado"),
        ("mercadolivre", "Mercado Livre", "Marketplace", "Nao configurado"),
        ("shopee", "Shopee", "Marketplace", "Nao configurado"),
    ]:
        conn.execute("INSERT INTO integration_configs (id, nome, tipo, status) VALUES (?, ?, ?, ?)", item)


def rows(sql, params=()):
    with connect() as conn:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]


def row(sql, params=()):
    with connect() as conn:
        result = conn.execute(sql, params).fetchone()
        return dict(result) if result else None
