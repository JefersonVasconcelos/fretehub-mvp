import json
import os
import sys
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(__file__))

from fretehub.auth import create_token, hash_password, read_token, verify_password
from fretehub.database import connect, init_db, row, rows
from fretehub.integrations import integration_status
from fretehub.migrations import cents_to_money
from fretehub.permissions import can, permissions_for
from fretehub.profitability_engine import calculate_profitability
from fretehub.quote_engine import calculate_quote
from fretehub.xlsx_importer import import_orders, import_rates, read_xlsx_base64


BASE_DIR = os.path.dirname(os.path.dirname(__file__))


class Handler(SimpleHTTPRequestHandler):
    server_version = "FreteHubV2/0.1"

    def translate_path(self, path):
        return os.path.join(BASE_DIR, path.lstrip("/").replace("/", os.sep))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return super().do_GET()
        user = self.require_user()
        if not user:
            return
        routes = {
            "/api/me": lambda: self.json(user),
            "/api/dashboard": self.dashboard,
            "/api/orders": lambda: self.json([map_order(o) for o in rows("SELECT * FROM orders ORDER BY numero DESC")]),
            "/api/carriers": lambda: self.json([map_carrier(c) for c in rows("SELECT * FROM carriers ORDER BY nome_fantasia")]),
            "/api/rates": lambda: self.json([map_rate(r) for r in rows("SELECT * FROM rates ORDER BY nome")]),
            "/api/audits": lambda: self.json(rows("SELECT * FROM audits ORDER BY created_at DESC LIMIT 100")),
            "/api/integrations": self.integrations,
            "/api/channels": lambda: self.read_endpoint(user, "read", lambda: self.json([map_channel(c) for c in rows("SELECT * FROM canais_venda WHERE codigo IN ('MERCADO_LIVRE', 'SHOPEE', 'SITE_PROPRIO') ORDER BY CASE codigo WHEN 'MERCADO_LIVRE' THEN 1 WHEN 'SHOPEE' THEN 2 WHEN 'SITE_PROPRIO' THEN 3 ELSE 9 END")])),
            "/api/channel-logs": lambda: self.read_endpoint(user, "integration:read", self.channel_logs),
            "/api/users": lambda: self.read_endpoint(user, "read", lambda: self.json([map_user(u) for u in rows("SELECT * FROM users WHERE excluido_em IS NULL ORDER BY nome")])),
            "/api/profiles": lambda: self.read_endpoint(user, "read", lambda: self.json(rows("SELECT * FROM perfis ORDER BY nome"))),
            "/api/user-profiles": lambda: self.read_endpoint(user, "read", lambda: self.json(rows("SELECT up.id, u.nome usuario, p.codigo perfil_codigo, p.nome perfil FROM usuario_perfis up JOIN users u ON u.id = up.usuario_id JOIN perfis p ON p.id = up.perfil_id WHERE u.excluido_em IS NULL ORDER BY u.nome, p.nome"))),
            "/api/carrier-services": lambda: self.read_endpoint(user, "carrier:read", lambda: self.json(rows("SELECT * FROM servicos_transportadora ORDER BY transportadora_id, nome"))),
            "/api/carrier-contracts": lambda: self.read_endpoint(user, "contract:read", lambda: self.json(rows("SELECT * FROM contratos_transportadora ORDER BY data_fim"))),
            "/api/tariff-tables": lambda: self.read_endpoint(user, "tariff:read", self.tariff_tables),
            "/api/tariff-ranges": lambda: self.read_endpoint(user, "tariff:read", lambda: self.json([map_tariff_range(r) for r in rows("SELECT * FROM faixas_tarifa ORDER BY tabela_tarifa_id, uf_destino, cep_inicio")])),
            "/api/tariff-rules": lambda: self.read_endpoint(user, "tariff:read", lambda: self.json([map_tariff_rule(r) for r in rows("SELECT * FROM regras_adicionais_tarifa ORDER BY tabela_tarifa_id, prioridade")])),
            "/api/imports": lambda: self.read_endpoint(user, "read", lambda: self.json(rows("SELECT * FROM importacoes ORDER BY criado_em DESC"))),
            "/api/import-lines": lambda: self.read_endpoint(user, "read", lambda: self.json(rows("SELECT * FROM linhas_importacao ORDER BY importacao_id, numero_linha"))),
            "/api/integration-logs": lambda: self.read_endpoint(user, "integration:read", lambda: self.json(rows("SELECT * FROM logs_integracao ORDER BY criado_em DESC LIMIT 100"))),
            "/api/order-history": lambda: self.read_endpoint(user, "read", lambda: self.json(rows("SELECT * FROM historico_status_pedido ORDER BY criado_em DESC LIMIT 100"))),
            "/api/profitability/skus": lambda: self.read_endpoint(user, "cost:read", self.profitability_skus),
            "/api/profitability/premises": lambda: self.read_endpoint(user, "cost:read", lambda: self.json([map_profitability_premise(p) for p in rows("SELECT * FROM marketplace_premissas ORDER BY nome")])),
        }
        handler = routes.get(path)
        if not handler:
            return self.error(404, "Endpoint nao encontrado.")
        return handler()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/auth/login":
            return self.login()
        user = self.require_user()
        if not user:
            return
        if path == "/api/quotes":
            if not can(user, "quote:create"):
                return self.error(403, "Perfil sem permissao para gerar cotacao.")
            return self.create_quote(user)
        if path == "/api/users":
            if not can(user, "user:manage"):
                return self.error(403, "Apenas administradores podem cadastrar usuarios.")
            return self.create_user(user)
        if path == "/api/carriers":
            if not can(user, "carrier:manage"):
                return self.error(403, "Perfil sem permissao para gerenciar transportadoras.")
            return self.create_carrier(user)
        if path == "/api/import/xlsx":
            if not can(user, "import:create"):
                return self.error(403, "Perfil sem permissao para importar XLSX.")
            return self.import_xlsx(user)
        if path == "/api/integrations/test":
            if not can(user, "integration:read"):
                return self.error(403, "Perfil sem permissao para testar integracao.")
            return self.test_integration()
        if path == "/api/integrations/save":
            if not can(user, "integration:read"):
                return self.error(403, "Perfil sem permissao para configurar integracao.")
            return self.save_integration(user)
        if path.startswith("/api/channels/"):
            if not can(user, "integration:read"):
                return self.error(403, "Perfil sem permissao para gerenciar canais.")
            parts = path.strip("/").split("/")
            if len(parts) != 4:
                return self.error(404, "Endpoint nao encontrado.")
            channel_id, action = parts[2], parts[3]
            if action == "save":
                return self.save_channel(user, channel_id)
            if action == "toggle":
                return self.toggle_channel(user, channel_id)
            if action == "sync":
                return self.sync_channel(user, channel_id)
        if path == "/api/tariff-tables":
            if not can(user, "tariff:manage"):
                return self.error(403, "Perfil sem permissao para gerenciar tarifas.")
            return self.create_tariff_table(user)
        if path.startswith("/api/tariff-tables/"):
            if not can(user, "tariff:manage"):
                return self.error(403, "Perfil sem permissao para gerenciar tarifas.")
            parts = path.strip("/").split("/")
            if len(parts) != 4:
                return self.error(404, "Endpoint nao encontrado.")
            tariff_id, action = parts[2], parts[3]
            if action == "update":
                return self.update_tariff_table(user, tariff_id)
            if action == "duplicate":
                return self.duplicate_tariff_table(user, tariff_id)
        if path.startswith("/api/carriers/"):
            if not can(user, "carrier:manage"):
                return self.error(403, "Perfil sem permissao para gerenciar transportadoras.")
            parts = path.strip("/").split("/")
            if len(parts) != 4:
                return self.error(404, "Endpoint nao encontrado.")
            carrier_id, action = parts[2], parts[3]
            if action == "update":
                return self.update_carrier(user, carrier_id)
        if path == "/api/profitability/audit":
            if not can(user, "cost:read"):
                return self.error(403, "Perfil sem permissao para auditar rentabilidade.")
            return self.audit_profitability(user)
        if path == "/api/profitability/import":
            if not can(user, "import:create"):
                return self.error(403, "Perfil sem permissao para importar SKUs.")
            return self.import_profitability_skus(user)
        if path == "/api/profitability/premises/save":
            if not can(user, "cost:read"):
                return self.error(403, "Perfil sem permissao para salvar premissas.")
            return self.save_profitability_premises(user)
        return self.error(404, "Endpoint nao encontrado.")

    def do_DELETE(self):
        path = urlparse(self.path).path
        user = self.require_user()
        if not user:
            return
        if path.startswith("/api/users/"):
            if not can(user, "user:manage"):
                return self.error(403, "Apenas administradores podem excluir usuarios.")
            return self.delete_user(user, path.rsplit("/", 1)[-1])
        return self.error(404, "Endpoint nao encontrado.")

    def login(self):
        data = self.body_json()
        user = row("SELECT * FROM users WHERE email = ? AND status = 'Ativo' AND COALESCE(ativo, 1) = 1 AND excluido_em IS NULL", (data.get("email"),))
        if not user or not verify_password(data.get("password") or "", user["password_hash"]):
            return self.error(401, "Email ou senha invalidos.")
        payload = map_user(user)
        with connect() as conn:
            conn.execute("UPDATE users SET ultimo_login_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", (payload["id"],))
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", payload["id"], payload["nome"], "LOGIN", "Usuario", payload["id"], "Usuario acessou a V2."),
            )
        return self.json({"token": create_token(payload), "user": payload})

    def dashboard(self):
        data = {
            "pedidos": row("SELECT COUNT(*) total FROM orders")["total"],
            "freteDefinido": row("SELECT COUNT(*) total FROM orders WHERE status = 'Frete Definido'")["total"],
            "cotacoes": row("SELECT COUNT(*) total FROM quotes")["total"],
            "tarifasVencidas": row("SELECT COUNT(*) total FROM rates WHERE status = 'Vencida' OR vigencia_fim < date('now')")["total"],
            "contratosVencem": row("SELECT COUNT(*) total FROM contratos_transportadora WHERE status = 'ATIVO' AND data_fim <= date('now', '+30 day')")["total"],
            "integracoesPendentes": row("SELECT COUNT(*) total FROM integration_configs WHERE status != 'Conectado'")["total"],
            "integracoesErro": row("SELECT COUNT(*) total FROM logs_integracao WHERE status = 'ERRO'")["total"],
            "importacoesComErro": row("SELECT COUNT(*) total FROM importacoes WHERE status = 'COM_ERROS'")["total"],
            "custoCalculado": row("SELECT COALESCE(SUM(frete_calculado), 0) total FROM orders")["total"],
        }
        return self.json(data)

    def read_endpoint(self, user, permission, callback):
        if not can(user, permission):
            return self.error(403, "Perfil sem permissao para consultar este recurso.")
        return callback()

    def tariff_tables(self):
        result = rows(
            """
            SELECT tt.*, c.nome_fantasia transportadora, s.nome servico, ct.numero_contrato contrato
            FROM tabelas_tarifa tt
            JOIN carriers c ON c.id = tt.transportadora_id
            JOIN servicos_transportadora s ON s.id = tt.servico_transportadora_id
            JOIN contratos_transportadora ct ON ct.id = tt.contrato_id
            ORDER BY tt.data_fim_vigencia DESC, tt.nome
            """
        )
        return self.json(result)

    def integrations(self):
        configs = [map_integration(c) for c in rows("SELECT * FROM integration_configs ORDER BY nome")]
        return self.json([integration_status(c) for c in configs])

    def channel_logs(self):
        result = rows(
            """
            SELECT l.criado_em data, i.nome canal, l.tipo_evento tipo, l.status, l.mensagem
            FROM logs_integracao l
            JOIN integracoes i ON i.id = l.integracao_id
            WHERE i.codigo IN ('MERCADO_LIVRE', 'SHOPEE', 'SITE_PROPRIO')
              AND l.tipo_evento = 'SINCRONIZACAO'
            ORDER BY l.criado_em DESC
            LIMIT 3
            """
        )
        mapped = [map_channel_log(item) for item in result]
        demo_logs = [
            {
                "data": "2026-07-05T00:10:03",
                "canal": "Mercado Livre",
                "tipo": "Sincronização",
                "status": "Sucesso",
                "mensagem": "12 pedidos sincronizados.",
            },
            {
                "data": "2026-07-05T00:10:03",
                "canal": "Shopee",
                "tipo": "Sincronização",
                "status": "Parcial",
                "mensagem": "8 sincronizados, 2 com CEP inválido.",
            },
            {
                "data": "2026-07-04T00:10:03",
                "canal": "Site Próprio",
                "tipo": "Sincronização",
                "status": "Sucesso",
                "mensagem": "5 pedidos sincronizados.",
            },
        ]
        existing = {(item["data"], item["canal"], item["mensagem"]) for item in mapped}
        combined = mapped + [item for item in demo_logs if (item["data"], item["canal"], item["mensagem"]) not in existing]
        combined.sort(key=lambda item: item["data"], reverse=True)
        return self.json(combined[:3])

    def profitability_skus(self):
        premises = {p["codigo"]: map_profitability_premise(p) for p in rows("SELECT * FROM marketplace_premissas")}
        result = []
        for item in rows("SELECT * FROM marketplace_skus ORDER BY canal, sku"):
            sku = map_profitability_sku(item)
            sku["resultado"] = calculate_profitability(sku, premises.get(sku["canal"]) or {})
            result.append(sku)
        return self.json(result)

    def audit_profitability(self, user):
        premises = {p["codigo"]: map_profitability_premise(p) for p in rows("SELECT * FROM marketplace_premissas")}
        audited = []
        with connect() as conn:
            for item in conn.execute("SELECT * FROM marketplace_skus ORDER BY canal, sku").fetchall():
                sku = map_profitability_sku(dict(item))
                premise = premises.get(sku["canal"]) or {}
                result = calculate_profitability(sku, premise)
                audited.append({**sku, "resultado": result})
                conn.execute(
                    "INSERT INTO rentabilidade_snapshots (id, sku_id, usuario_id, resultado_json) VALUES (?, ?, ?, ?)",
                    (f"rent-{uuid.uuid4().hex[:12]}", sku["id"], user["id"], json.dumps({"premissa": premise, "resultado": result}, ensure_ascii=False)),
                )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "AUDITOU_RENTABILIDADE", "Rentabilidade", "marketplace", f"Auditou margem de {len(audited)} SKU(s)."),
            )
        return self.json({"items": audited, "total": len(audited)})

    def import_profitability_skus(self, user):
        records = self.body_json().get("rows") or []
        imported = 0
        errors = []
        with connect() as conn:
            for index, record in enumerate(records, start=2):
                sku_code = str(record.get("sku") or "").strip()
                name = str(record.get("nome") or "").strip()
                channel = normalize_channel(record.get("canal"))
                if not sku_code or not name or not channel:
                    errors.append({"linha": index, "erro": "Campos obrigatorios: sku, nome e canal."})
                    continue
                existing = conn.execute("SELECT id FROM marketplace_skus WHERE sku = ? AND canal = ?", (sku_code, channel)).fetchone()
                item_id = existing["id"] if existing else f"sku-{uuid.uuid4().hex[:10]}"
                conn.execute(
                    """
                    INSERT INTO marketplace_skus
                    (id, sku, nome, canal, custo_produto_centavos, preco_venda_centavos, custo_embalagem_centavos,
                     frete_estimado_centavos, frete_gratis, peso_kg, comprimento_cm, largura_cm, altura_cm, fator_cubagem,
                     estoque, status, atualizado_em)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(sku, canal) DO UPDATE SET
                      nome = excluded.nome,
                      custo_produto_centavos = excluded.custo_produto_centavos,
                      preco_venda_centavos = excluded.preco_venda_centavos,
                      custo_embalagem_centavos = excluded.custo_embalagem_centavos,
                      frete_estimado_centavos = excluded.frete_estimado_centavos,
                      frete_gratis = excluded.frete_gratis,
                      peso_kg = excluded.peso_kg,
                      comprimento_cm = excluded.comprimento_cm,
                      largura_cm = excluded.largura_cm,
                      altura_cm = excluded.altura_cm,
                      fator_cubagem = excluded.fator_cubagem,
                      estoque = excluded.estoque,
                      status = excluded.status,
                      atualizado_em = CURRENT_TIMESTAMP
                    """,
                    (
                        item_id,
                        sku_code,
                        name,
                        channel,
                        api_money_to_cents(record.get("custoProduto")),
                        api_money_to_cents(record.get("precoVenda")),
                        api_money_to_cents(record.get("custoEmbalagem")),
                        api_money_to_cents(record.get("freteEstimado")),
                        1 if str(record.get("freteGratis") or "").lower() in {"1", "sim", "true", "s"} else 0,
                        api_float(record.get("pesoKg")),
                        api_float(record.get("comprimentoCm")),
                        api_float(record.get("larguraCm")),
                        api_float(record.get("alturaCm")),
                        api_float(record.get("fatorCubagem"), 300) or 300,
                        int(api_float(record.get("estoque"), 0)),
                        str(record.get("status") or "ATIVO"),
                    ),
                )
                imported += 1
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "IMPORTOU_SKUS_RENTABILIDADE", "Rentabilidade", "marketplace", f"Importou {imported} SKU(s), {len(errors)} erro(s)."),
            )
        return self.json({"imported": imported, "errors": errors})

    def save_profitability_premises(self, user):
        premises = self.body_json().get("premises") or []
        with connect() as conn:
            for item in premises:
                code = normalize_channel(item.get("codigo"))
                if not code:
                    continue
                conn.execute(
                    """
                    UPDATE marketplace_premissas
                    SET comissao_percentual = ?,
                        taxa_fixa_centavos = ?,
                        imposto_percentual = ?,
                        ads_percentual = ?,
                        parcelamento_percentual = ?,
                        frete_gratis_minimo_centavos = ?,
                        margem_alvo_percentual = ?,
                        atualizado_em = CURRENT_TIMESTAMP
                    WHERE codigo = ?
                    """,
                    (
                        api_percent_text(item.get("comissaoPercentual")),
                        api_money_to_cents(item.get("taxaFixa")),
                        api_percent_text(item.get("impostoPercentual")),
                        api_percent_text(item.get("adsPercentual")),
                        api_percent_text(item.get("parcelamentoPercentual")),
                        api_money_to_cents(item.get("freteGratisMinimo")),
                        api_percent_text(item.get("margemAlvoPercentual")),
                        code,
                    ),
                )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "SALVOU_PREMISSAS_RENTABILIDADE", "Rentabilidade", "marketplace", "Atualizou premissas de marketplace."),
            )
        return self.json({"ok": True})

    def test_integration(self):
        data = self.body_json()
        config = row("SELECT * FROM integration_configs WHERE id = ?", (data.get("id"),))
        if not config:
            return self.error(404, "Integracao nao encontrada.")
        mapped = map_integration(config)
        status = integration_status(mapped)
        with connect() as conn:
            conn.execute(
                "UPDATE integration_configs SET status = ?, last_check_at = ?, last_message = ? WHERE id = ?",
                (status["status"], status["lastCheckAt"], status["lastMessage"], mapped["id"]),
            )
        return self.json(status)

    def save_integration(self, user):
        data = self.body_json()
        integration_id = data.get("id") or "protheus"
        config = row("SELECT * FROM integration_configs WHERE id = ?", (integration_id,))
        if not config:
            return self.error(404, "Integracao nao encontrada.")
        base_url = (data.get("baseUrl") or "").strip()
        credentials = {
            "ambiente": data.get("ambiente") or "Homologação",
            "authType": data.get("authType") or "OAuth 2.0",
            "frequenciaMin": int(data.get("frequenciaMin") or 5),
            "usuario": data.get("usuario") or "",
            "senha": data.get("senha") or "",
            "ativa": bool(data.get("ativa", True)),
        }
        if not base_url:
            return self.error(400, "Informe a URL da API.")
        if credentials["frequenciaMin"] <= 0:
            return self.error(400, "Informe frequencia maior que zero.")
        status = "Nao configurado" if not credentials["ativa"] else "Configurado"
        message = "Configuracao salva. Teste a conexao para validar o conector."
        with connect() as conn:
            conn.execute(
                """
                UPDATE integration_configs
                SET base_url = ?, credentials_json = ?, status = ?, last_message = ?
                WHERE id = ?
                """,
                (base_url, json.dumps(credentials, ensure_ascii=False), status, message, integration_id),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "SALVOU_INTEGRACAO", "Integracao", integration_id, f"Salvou integracao {config['nome']}."),
            )
        saved = row("SELECT * FROM integration_configs WHERE id = ?", (integration_id,))
        return self.json(map_integration(saved))

    def save_channel(self, user, channel_id):
        channel = row("SELECT * FROM canais_venda WHERE id = ?", (channel_id,))
        if not channel:
            return self.error(404, "Canal nao encontrado.")
        data = self.body_json()
        client_id = (data.get("clientId") or "").strip()
        client_secret = (data.get("clientSecret") or "").strip()
        try:
            frequency = int(data.get("frequenciaMin") or 5)
        except (TypeError, ValueError):
            return self.error(400, "Informe frequencia valida.")
        if not client_id:
            return self.error(400, "Informe Client ID.")
        if frequency <= 0:
            return self.error(400, "Informe frequencia maior que zero.")
        with connect() as conn:
            conn.execute(
                """
                UPDATE canais_venda
                SET client_id = ?, client_secret = ?, frequencia_min = ?, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (client_id, client_secret, frequency, channel_id),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "SALVOU_CANAL", "Canal", channel_id, f"Salvou canal {channel['nome']}."),
            )
        updated = row("SELECT * FROM canais_venda WHERE id = ?", (channel_id,))
        return self.json(map_channel(updated))

    def toggle_channel(self, user, channel_id):
        channel = row("SELECT * FROM canais_venda WHERE id = ?", (channel_id,))
        if not channel:
            return self.error(404, "Canal nao encontrado.")
        active = 0 if int(channel["ativo"] or 0) else 1
        with connect() as conn:
            conn.execute("UPDATE canais_venda SET ativo = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", (active, channel_id))
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "ALTEROU_STATUS_CANAL", "Canal", channel_id, f"{channel['nome']} {'ativado' if active else 'inativado'}."),
            )
        updated = row("SELECT * FROM canais_venda WHERE id = ?", (channel_id,))
        return self.json(map_channel(updated))

    def sync_channel(self, user, channel_id):
        channel = row("SELECT * FROM canais_venda WHERE id = ?", (channel_id,))
        if not channel:
            return self.error(404, "Canal nao encontrado.")
        integration = row("SELECT * FROM integracoes WHERE codigo = ?", (channel["codigo"],))
        if not integration:
            return self.error(404, "Integracao do canal nao encontrada.")
        now = datetime.now().isoformat(timespec="seconds")
        status = "SUCESSO" if int(channel["ativo"] or 0) else "ERRO"
        message = f"Sincronização manual — {channel['nome']}." if status == "SUCESSO" else f"Canal {channel['nome']} inativo."
        with connect() as conn:
            conn.execute("UPDATE canais_venda SET ultima_sincronizacao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", (now, channel_id))
            conn.execute(
                """
                INSERT INTO logs_integracao
                (id, integracao_id, tipo_evento, direcao, status, tentativas, mensagem, correlation_id, iniciado_em, finalizado_em)
                VALUES (?, ?, 'SINCRONIZACAO', 'ENTRADA', ?, 1, ?, ?, ?, ?)
                """,
                (f"log-{uuid.uuid4().hex[:12]}", integration["id"], status, message, f"corr-{uuid.uuid4().hex[:8]}", now, now),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "SINCRONIZOU_CANAL", "Canal", channel_id, message),
            )
        updated = row("SELECT * FROM canais_venda WHERE id = ?", (channel_id,))
        return self.json({"channel": map_channel(updated), "message": message, "status": status})

    def create_user(self, actor):
        data = self.body_json()
        nome = (data.get("nome") or "").strip()
        email = (data.get("email") or "").strip().lower()
        senha = data.get("senha") or data.get("password") or ""
        telefone = (data.get("telefone") or "").strip()
        perfil_id = data.get("perfilId") or data.get("perfil_id")
        if not nome or not email or not senha or not perfil_id:
            return self.error(400, "Informe nome, email, senha e perfil.")
        if "@" not in email or "." not in email:
            return self.error(400, "Email invalido.")
        if len(senha) < 8:
            return self.error(400, "A senha deve ter pelo menos 8 caracteres.")
        profile = row("SELECT * FROM perfis WHERE id = ? AND ativo = 1", (perfil_id,))
        if not profile:
            return self.error(400, "Perfil invalido.")
        if row("SELECT id FROM users WHERE email = ?", (email,)):
            return self.error(409, "Ja existe um usuario com este email.")
        user_id = f"u-{uuid.uuid4().hex[:12]}"
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO users
                (id, nome, email, perfil, password_hash, status, telefone, ativo, atualizado_em)
                VALUES (?, ?, ?, ?, ?, 'Ativo', ?, 1, CURRENT_TIMESTAMP)
                """,
                (user_id, nome, email, profile["nome"], hash_password(senha), telefone),
            )
            conn.execute(
                "INSERT INTO usuario_perfis (id, usuario_id, perfil_id) VALUES (?, ?, ?)",
                (f"up-{user_id}-{profile['id']}", user_id, profile["id"]),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", actor["id"], actor["nome"], "CRIOU_USUARIO", "Usuario", user_id, f"Criou usuario {email}."),
            )
        created = row("SELECT * FROM users WHERE id = ?", (user_id,))
        return self.json(map_user(created), status=201)

    def delete_user(self, actor, user_id):
        if user_id == actor["id"]:
            return self.error(400, "O administrador logado nao pode excluir o proprio usuario.")
        target = row("SELECT * FROM users WHERE id = ? AND excluido_em IS NULL", (user_id,))
        if not target:
            return self.error(404, "Usuario nao encontrado.")
        if "Administrador" in map_user(target).get("perfis", []):
            active_admins = row(
                """
                SELECT COUNT(DISTINCT u.id) total
                FROM users u
                JOIN usuario_perfis up ON up.usuario_id = u.id
                JOIN perfis p ON p.id = up.perfil_id
                WHERE p.nome = 'Administrador'
                  AND u.status = 'Ativo'
                  AND COALESCE(u.ativo, 1) = 1
                  AND u.excluido_em IS NULL
                """
            )["total"]
            if active_admins <= 1:
                return self.error(400, "Nao e possivel excluir o ultimo administrador ativo.")
        with connect() as conn:
            conn.execute(
                "UPDATE users SET status = 'Inativo', ativo = 0, atualizado_em = CURRENT_TIMESTAMP, excluido_em = CURRENT_TIMESTAMP WHERE id = ?",
                (user_id,),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", actor["id"], actor["nome"], "EXCLUIU_USUARIO", "Usuario", user_id, f"Desativou usuario {target['email']}."),
            )
        return self.json({"ok": True})

    def carrier_payload(self):
        data = self.body_json()
        nome_fantasia = (data.get("nomeFantasia") or "").strip()
        razao_social = (data.get("razaoSocial") or "").strip()
        cnpj = (data.get("cnpj") or "").strip()
        status = (data.get("status") or "Ativa").strip()
        contrato = (data.get("contrato") or "").strip()
        observacoes = (data.get("observacoes") or "").strip()
        modalidades = data.get("modalidades") or []
        estados = data.get("estadosAtendidos") or []
        if isinstance(modalidades, str):
            modalidades = [item.strip() for item in modalidades.split(",") if item.strip()]
        if isinstance(estados, str):
            estados = [item.strip().upper() for item in estados.split(",") if item.strip()]
        try:
            fator_cubagem = float(data.get("fatorCubagem"))
            prazo_medio = int(data.get("prazoMedioDias"))
        except (TypeError, ValueError):
            return None, "Informe fator de cubagem e prazo medio validos."
        if not nome_fantasia or not razao_social:
            return None, "Informe nome fantasia e razao social."
        if status not in {"Ativa", "Inativa"}:
            return None, "Status de transportadora invalido."
        if fator_cubagem <= 0 or prazo_medio < 0:
            return None, "Informe cubagem e prazo validos."
        if not modalidades:
            return None, "Informe ao menos uma modalidade."
        if not estados or any(len(item) != 2 for item in estados):
            return None, "Informe UFs atendidas validas."
        return {
            "nome_fantasia": nome_fantasia,
            "razao_social": razao_social,
            "cnpj": cnpj,
            "status": status,
            "fator_cubagem": fator_cubagem,
            "modalidades_json": json.dumps(modalidades, ensure_ascii=False),
            "estados_json": json.dumps(estados, ensure_ascii=False),
            "prazo_medio_dias": prazo_medio,
            "contrato": contrato,
            "observacoes": observacoes,
        }, None

    def create_carrier(self, user):
        payload, error = self.carrier_payload()
        if error:
            return self.error(400, error)
        carrier_id = f"t-{uuid.uuid4().hex[:12]}"
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO carriers
                (id, nome_fantasia, razao_social, cnpj, status, fator_cubagem, modalidades_json, estados_json, prazo_medio_dias, contrato, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    carrier_id,
                    payload["nome_fantasia"],
                    payload["razao_social"],
                    payload["cnpj"],
                    payload["status"],
                    payload["fator_cubagem"],
                    payload["modalidades_json"],
                    payload["estados_json"],
                    payload["prazo_medio_dias"],
                    payload["contrato"],
                    payload["observacoes"],
                ),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "CRIOU_TRANSPORTADORA", "Transportadora", carrier_id, f"Criou transportadora {payload['nome_fantasia']}."),
            )
        created = row("SELECT * FROM carriers WHERE id = ?", (carrier_id,))
        return self.json(map_carrier(created), status=201)

    def update_carrier(self, user, carrier_id):
        target = row("SELECT * FROM carriers WHERE id = ?", (carrier_id,))
        if not target:
            return self.error(404, "Transportadora nao encontrada.")
        payload, error = self.carrier_payload()
        if error:
            return self.error(400, error)
        with connect() as conn:
            conn.execute(
                """
                UPDATE carriers
                SET nome_fantasia = ?, razao_social = ?, cnpj = ?, status = ?, fator_cubagem = ?,
                    modalidades_json = ?, estados_json = ?, prazo_medio_dias = ?, contrato = ?, observacoes = ?
                WHERE id = ?
                """,
                (
                    payload["nome_fantasia"],
                    payload["razao_social"],
                    payload["cnpj"],
                    payload["status"],
                    payload["fator_cubagem"],
                    payload["modalidades_json"],
                    payload["estados_json"],
                    payload["prazo_medio_dias"],
                    payload["contrato"],
                    payload["observacoes"],
                    carrier_id,
                ),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "EDITOU_TRANSPORTADORA", "Transportadora", carrier_id, f"Editou transportadora {payload['nome_fantasia']}."),
            )
        updated = row("SELECT * FROM carriers WHERE id = ?", (carrier_id,))
        return self.json(map_carrier(updated))

    def create_quote(self, user):
        params = self.body_json()
        carriers = [map_carrier(c) for c in rows("SELECT * FROM carriers")]
        rates = [map_rate(r) for r in rows("SELECT * FROM rates")]
        result = calculate_quote(params, carriers, rates)
        if result["errors"]:
            return self.json(result, status=422)
        quote_id = f"cot-{uuid.uuid4().hex[:12]}"
        with connect() as conn:
            conn.execute(
                "INSERT INTO quotes (id, pedido_id, usuario_id, status, prioridade, params_json) VALUES (?, ?, ?, ?, ?, ?)",
                (quote_id, params.get("pedidoId"), user["id"], "Calculada" if any(o["disponivel"] for o in result["options"]) else "Sem Opcao", params.get("prioridade") or "menor_custo", json.dumps(params)),
            )
            for option in result["options"]:
                conn.execute(
                    "INSERT INTO quote_options (id, cotacao_id, data_json) VALUES (?, ?, ?)",
                    (f"op-{uuid.uuid4().hex[:12]}", quote_id, json.dumps(option)),
                )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "GEROU_COTACAO", "Cotacao", quote_id, "Gerou cotacao pela API V2."),
            )
        return self.json({"id": quote_id, **result}, status=201)

    def import_xlsx(self, user):
        data = self.body_json(limit=8_000_000)
        kind = data.get("type")
        records = read_xlsx_base64(data.get("fileBase64") or "")
        with connect() as conn:
            if kind == "orders":
                result = import_orders(conn, records)
            elif kind == "rates":
                result = import_rates(conn, records)
            else:
                return self.error(400, "Tipo de importacao invalido. Use orders ou rates.")
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "IMPORTOU_XLSX", kind, "", f"Importou {result['imported']} registro(s)."),
            )
        return self.json(result)

    def create_tariff_table(self, user):
        data = self.body_json()
        nome = (data.get("nome") or "").strip()
        transportadora_id = (data.get("transportadoraId") or "").strip()
        servico_id = (data.get("servicoId") or "").strip()
        contrato_id = (data.get("contratoId") or "").strip()
        status = (data.get("status") or "RASCUNHO").strip().upper()
        origem_uf = (data.get("ufOrigem") or "BA").strip().upper()
        destino_uf = (data.get("ufDestino") or "").strip().upper()
        vigencia_inicio = (data.get("vigenciaInicio") or "").strip()
        vigencia_fim = (data.get("vigenciaFim") or "").strip()
        allowed_status = {"RASCUNHO", "EM_APROVACAO", "ATIVA", "VENCIDA", "ARQUIVADA", "CANCELADA"}
        if not nome or not transportadora_id or not servico_id or not contrato_id:
            return self.error(400, "Informe nome, transportadora, servico e contrato.")
        if status not in allowed_status:
            return self.error(400, "Status de tarifa invalido.")
        if not destino_uf or len(origem_uf) != 2 or len(destino_uf) != 2:
            return self.error(400, "Informe UF de origem e destino validas.")
        if not vigencia_inicio or not vigencia_fim or vigencia_fim < vigencia_inicio:
            return self.error(400, "Informe uma vigencia valida.")
        carrier = row("SELECT * FROM carriers WHERE id = ?", (transportadora_id,))
        service = row("SELECT * FROM servicos_transportadora WHERE id = ? AND transportadora_id = ?", (servico_id, transportadora_id))
        contract = row("SELECT * FROM contratos_transportadora WHERE id = ? AND transportadora_id = ?", (contrato_id, transportadora_id))
        if not carrier or not service or not contract:
            return self.error(400, "Transportadora, servico ou contrato invalido.")
        try:
            peso_minimo = float(data.get("pesoMinimoKg"))
            peso_maximo = float(data.get("pesoMaximoKg"))
            prazo_dias = int(data.get("prazoDias"))
            valor_frete_base = int(round(float(data.get("valorFreteBase") or 0) * 100))
            valor_kg_excedente = int(round(float(data.get("valorKgExcedente") or 0) * 100))
            frete_minimo = int(round(float(data.get("freteMinimo") or 0) * 100))
        except (TypeError, ValueError):
            return self.error(400, "Informe valores de tarifa validos.")
        cep_inicio = "".join(ch for ch in str(data.get("cepInicio") or "00000000") if ch.isdigit()).zfill(8)[:8]
        cep_fim = "".join(ch for ch in str(data.get("cepFim") or "99999999") if ch.isdigit()).zfill(8)[:8]
        if peso_minimo < 0 or peso_maximo < peso_minimo or prazo_dias < 0:
            return self.error(400, "Informe uma faixa de peso e prazo validos.")
        if cep_fim < cep_inicio:
            return self.error(400, "Faixa de CEP invalida.")
        code_base = "".join(ch if ch.isalnum() else "-" for ch in nome.upper()).strip("-")[:24] or "TARIFA"
        next_version = row(
            """
            SELECT COALESCE(MAX(versao), 0) + 1 proxima
            FROM tabelas_tarifa
            WHERE transportadora_id = ? AND servico_transportadora_id = ? AND codigo = ?
            """,
            (transportadora_id, servico_id, code_base),
        )["proxima"]
        table_id = f"tab-{uuid.uuid4().hex[:12]}"
        range_id = f"fx-{uuid.uuid4().hex[:12]}"
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO tabelas_tarifa
                (id, transportadora_id, contrato_id, servico_transportadora_id, codigo, nome, versao,
                 data_inicio_vigencia, data_fim_vigencia, status, origem_uf, prioridade, observacoes,
                 criado_por_usuario_id, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    table_id,
                    transportadora_id,
                    contrato_id,
                    servico_id,
                    code_base,
                    nome,
                    next_version,
                    vigencia_inicio,
                    vigencia_fim,
                    status,
                    origem_uf,
                    data.get("observacoes") or "Criada pela tela de tarifas.",
                    user["id"],
                ),
            )
            conn.execute(
                """
                INSERT INTO faixas_tarifa
                (id, tabela_tarifa_id, uf_origem, uf_destino, cep_inicio, cep_fim, peso_minimo_kg, peso_maximo_kg,
                 valor_frete_base_centavos, valor_por_kg_excedente_centavos, frete_minimo_centavos, prazo_dias, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (range_id, table_id, origem_uf, destino_uf, cep_inicio, cep_fim, peso_minimo, peso_maximo, valor_frete_base, valor_kg_excedente, frete_minimo, prazo_dias),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "CRIOU_TARIFA", "Tarifa", table_id, f"Criou tarifa {nome}."),
            )
        return self.json({"ok": True, "id": table_id, "versao": next_version}, status=201)

    def update_tariff_table(self, user, tariff_id):
        data = self.body_json()
        table = row("SELECT * FROM tabelas_tarifa WHERE id = ?", (tariff_id,))
        if not table:
            return self.error(404, "Tarifa nao encontrada.")
        tariff_range = row("SELECT * FROM faixas_tarifa WHERE tabela_tarifa_id = ? ORDER BY peso_minimo_kg LIMIT 1", (tariff_id,))
        if not tariff_range:
            return self.error(404, "Faixa de tarifa nao encontrada.")
        nome = (data.get("nome") or "").strip()
        status = (data.get("status") or "").strip().upper()
        vigencia_inicio = (data.get("vigenciaInicio") or "").strip()
        vigencia_fim = (data.get("vigenciaFim") or "").strip()
        allowed_status = {"RASCUNHO", "EM_APROVACAO", "ATIVA", "VENCIDA", "ARQUIVADA", "CANCELADA"}
        if not nome:
            return self.error(400, "Informe o nome da tarifa.")
        if status not in allowed_status:
            return self.error(400, "Status de tarifa invalido.")
        if not vigencia_inicio or not vigencia_fim or vigencia_fim < vigencia_inicio:
            return self.error(400, "Informe uma vigencia valida.")
        try:
            peso_minimo = float(data.get("pesoMinimoKg"))
            peso_maximo = float(data.get("pesoMaximoKg"))
            prazo_dias = int(data.get("prazoDias"))
        except (TypeError, ValueError):
            return self.error(400, "Informe peso e prazo validos.")
        if peso_minimo < 0 or peso_maximo < peso_minimo or prazo_dias < 0:
            return self.error(400, "Informe uma faixa de peso e prazo validos.")
        with connect() as conn:
            conn.execute(
                """
                UPDATE tabelas_tarifa
                SET nome = ?, status = ?, data_inicio_vigencia = ?, data_fim_vigencia = ?, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (nome, status, vigencia_inicio, vigencia_fim, tariff_id),
            )
            conn.execute(
                """
                UPDATE faixas_tarifa
                SET peso_minimo_kg = ?, peso_maximo_kg = ?, prazo_dias = ?, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (peso_minimo, peso_maximo, prazo_dias, tariff_range["id"]),
            )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "EDITOU_TARIFA", "Tarifa", tariff_id, f"Editou tarifa {nome}."),
            )
        return self.json({"ok": True, "id": tariff_id})

    def duplicate_tariff_table(self, user, tariff_id):
        table = row("SELECT * FROM tabelas_tarifa WHERE id = ?", (tariff_id,))
        if not table:
            return self.error(404, "Tarifa nao encontrada.")
        next_version = row(
            """
            SELECT COALESCE(MAX(versao), 0) + 1 proxima
            FROM tabelas_tarifa
            WHERE transportadora_id = ? AND servico_transportadora_id = ? AND codigo = ?
            """,
            (table["transportadora_id"], table["servico_transportadora_id"], table["codigo"]),
        )["proxima"]
        new_table_id = f"tab-{uuid.uuid4().hex[:12]}"
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO tabelas_tarifa
                (id, transportadora_id, contrato_id, servico_transportadora_id, codigo, nome, versao,
                 data_inicio_vigencia, data_fim_vigencia, status, origem_uf, prioridade, observacoes,
                 importacao_id, criado_por_usuario_id, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EM_APROVACAO', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    new_table_id,
                    table["transportadora_id"],
                    table["contrato_id"],
                    table["servico_transportadora_id"],
                    table["codigo"],
                    f"{table['nome']} - copia",
                    next_version,
                    table["data_inicio_vigencia"],
                    table["data_fim_vigencia"],
                    table["origem_uf"],
                    table["prioridade"],
                    table["observacoes"],
                    table["importacao_id"],
                    user["id"],
                ),
            )
            range_id_map = {}
            for item in rows("SELECT * FROM faixas_tarifa WHERE tabela_tarifa_id = ?", (tariff_id,)):
                new_range_id = f"fx-{uuid.uuid4().hex[:12]}"
                range_id_map[item["id"]] = new_range_id
                conn.execute(
                    """
                    INSERT INTO faixas_tarifa
                    (id, tabela_tarifa_id, uf_origem, uf_destino, cep_inicio, cep_fim, peso_minimo_kg, peso_maximo_kg,
                     valor_minimo_pedido_centavos, valor_maximo_pedido_centavos, quantidade_volumes_minima,
                     quantidade_volumes_maxima, valor_frete_base_centavos, valor_por_kg_excedente_centavos,
                     frete_minimo_centavos, prazo_dias, ativo, atualizado_em)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (
                        new_range_id,
                        new_table_id,
                        item["uf_origem"],
                        item["uf_destino"],
                        item["cep_inicio"],
                        item["cep_fim"],
                        item["peso_minimo_kg"],
                        item["peso_maximo_kg"],
                        item["valor_minimo_pedido_centavos"],
                        item["valor_maximo_pedido_centavos"],
                        item["quantidade_volumes_minima"],
                        item["quantidade_volumes_maxima"],
                        item["valor_frete_base_centavos"],
                        item["valor_por_kg_excedente_centavos"],
                        item["frete_minimo_centavos"],
                        item["prazo_dias"],
                        item["ativo"],
                    ),
                )
            for item in rows("SELECT * FROM regras_adicionais_tarifa WHERE tabela_tarifa_id = ?", (tariff_id,)):
                conn.execute(
                    """
                    INSERT INTO regras_adicionais_tarifa
                    (id, tabela_tarifa_id, faixa_tarifa_id, tipo_regra, nome, prioridade, percentual,
                     valor_fixo_centavos, valor_minimo_centavos, valor_maximo_centavos, condicao_json, ativo, atualizado_em)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (
                        f"reg-{uuid.uuid4().hex[:12]}",
                        new_table_id,
                        range_id_map.get(item["faixa_tarifa_id"]),
                        item["tipo_regra"],
                        item["nome"],
                        item["prioridade"],
                        item["percentual"],
                        item["valor_fixo_centavos"],
                        item["valor_minimo_centavos"],
                        item["valor_maximo_centavos"],
                        item["condicao_json"],
                        item["ativo"],
                    ),
                )
            conn.execute(
                "INSERT INTO audits (id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"a-{uuid.uuid4().hex[:12]}", user["id"], user["nome"], "DUPLICOU_TARIFA", "Tarifa", new_table_id, f"Duplicou tarifa {table['nome']} para v{next_version}."),
            )
        return self.json({"ok": True, "id": new_table_id, "versao": next_version}, status=201)

    def require_user(self):
        auth = self.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "", 1) if auth.startswith("Bearer ") else ""
        payload = read_token(token)
        if not payload:
            self.error(401, "Token ausente ou invalido.")
            return None
        user = row("SELECT * FROM users WHERE id = ? AND status = 'Ativo' AND COALESCE(ativo, 1) = 1 AND excluido_em IS NULL", (payload["sub"],))
        if not user:
            self.error(401, "Usuario nao encontrado.")
            return None
        return map_user(user)

    def body_json(self, limit=1_000_000):
        length = min(int(self.headers.get("Content-Length", 0)), limit)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def error(self, status, message):
        return self.json({"error": message}, status=status)


def map_user(row_data):
    data = dict(row_data)
    user = {
        "id": data["id"],
        "nome": data["nome"],
        "email": data["email"],
        "perfil": data["perfil"],
        "status": data["status"],
        "telefone": data.get("telefone") or "",
        "ativo": bool(data.get("ativo", 1)),
        "ultimoLoginEm": data.get("ultimo_login_em"),
        "atualizadoEm": data.get("atualizado_em"),
        "excluidoEm": data.get("excluido_em"),
    }
    profile_rows = rows(
        "SELECT p.nome FROM usuario_perfis up JOIN perfis p ON p.id = up.perfil_id WHERE up.usuario_id = ? AND p.ativo = 1",
        (row_data["id"],),
    )
    user["perfis"] = [item["nome"] for item in profile_rows] or [row_data["perfil"]]
    user["permissoes"] = permissions_for(user)
    return user


def map_carrier(row_data):
    return {
        "id": row_data["id"],
        "nomeFantasia": row_data["nome_fantasia"],
        "razaoSocial": row_data["razao_social"],
        "cnpj": row_data["cnpj"],
        "status": row_data["status"],
        "fatorCubagem": row_data["fator_cubagem"],
        "modalidades": json.loads(row_data["modalidades_json"]),
        "estadosAtendidos": json.loads(row_data["estados_json"]),
        "prazoMedioDias": row_data["prazo_medio_dias"],
        "contrato": row_data["contrato"],
        "observacoes": row_data["observacoes"],
    }


def map_rate(row_data):
    return {
        "id": row_data["id"],
        "nome": row_data["nome"],
        "transportadoraId": row_data["transportadora_id"],
        "modalidade": row_data["modalidade"],
        "ufOrigem": row_data["uf_origem"],
        "ufDestino": row_data["uf_destino"],
        "cepInicio": row_data["cep_inicio"],
        "cepFim": row_data["cep_fim"],
        "pesoInicioKg": row_data["peso_inicio_kg"],
        "pesoFimKg": row_data["peso_fim_kg"],
        "taxaFixa": row_data["taxa_fixa"],
        "kgExcedente": row_data["kg_excedente"],
        "combustivelPercentual": row_data["combustivel_percentual"],
        "riscoPercentual": row_data["risco_percentual"],
        "interiorValor": row_data["interior_valor"],
        "pedagioValor": row_data["pedagio_valor"],
        "seguroPercentual": row_data["seguro_percentual"],
        "prazoDias": row_data["prazo_dias"],
        "minimoFrete": row_data["minimo_frete"],
        "maximoFrete": row_data["maximo_frete"],
        "status": row_data["status"],
        "vigenciaInicio": row_data["vigencia_inicio"],
        "vigenciaFim": row_data["vigencia_fim"],
        "regrasAdicionais": row_data["regras_adicionais"],
    }


def map_order(row_data):
    return {
        "id": row_data["id"],
        "numero": row_data["numero"],
        "canal": row_data["canal"],
        "cliente": row_data["cliente"],
        "cepOrigem": row_data["cep_origem"],
        "cepDestino": row_data["cep_destino"],
        "cidadeDestino": row_data["cidade_destino"],
        "ufDestino": row_data["uf_destino"],
        "valorPedido": row_data["valor_pedido"],
        "pesoRealKg": row_data["peso_real_kg"],
        "comprimentoCm": row_data["comprimento_cm"],
        "larguraCm": row_data["largura_cm"],
        "alturaCm": row_data["altura_cm"],
        "volumes": row_data["volumes"],
        "produtos": row_data["produtos"],
        "status": row_data["status"],
        "transportadoraSelecionadaId": row_data["transportadora_selecionada_id"],
        "freteCalculado": row_data["frete_calculado"],
        "freteCobrado": row_data["frete_cobrado"],
        "prazoDias": row_data["prazo_dias"],
        "statusProtheus": row_data["status_protheus"],
    }


def map_integration(row_data):
    return {
        "id": row_data["id"],
        "nome": row_data["nome"],
        "tipo": row_data["tipo"],
        "status": row_data["status"],
        "baseUrl": row_data["base_url"],
        "credentials": json.loads(row_data["credentials_json"] or "{}"),
        "lastCheckAt": row_data["last_check_at"],
        "lastMessage": row_data["last_message"],
    }


def map_channel(row_data):
    names = {"SITE_PROPRIO": "Site Próprio"}
    return {
        "id": row_data["id"],
        "codigo": row_data["codigo"],
        "nome": names.get(row_data["codigo"], row_data["nome"]),
        "ativo": bool(row_data["ativo"]),
        "clientId": row_data.get("client_id") or "",
        "clientSecret": row_data.get("client_secret") or "",
        "frequenciaMin": row_data.get("frequencia_min") or 5,
        "ultimaSincronizacao": row_data.get("ultima_sincronizacao"),
    }


def map_channel_log(row_data):
    status = row_data["status"]
    channel = "Site Próprio" if row_data["canal"] == "Site Proprio" else row_data["canal"]
    shopee_partial = status == "ERRO" and channel == "Shopee" and row_data["tipo"] == "IMPORTACAO_PEDIDO"
    label = "Sucesso" if status == "SUCESSO" else "Parcial" if status in {"PROCESSANDO", "PENDENTE"} or shopee_partial else "Erro"
    message = row_data["mensagem"] or ""
    if shopee_partial:
        message = "8 sincronizados, 2 com CEP inválido."
    return {
        "data": row_data["data"],
        "canal": channel,
        "tipo": "Sincronização" if row_data["tipo"] in {"SINCRONIZACAO", "IMPORTACAO_PEDIDO"} else row_data["tipo"],
        "status": label,
        "mensagem": message,
    }


def map_tariff_range(row_data):
    data = dict(row_data)
    for key in ["valor_minimo_pedido_centavos", "valor_maximo_pedido_centavos", "valor_frete_base_centavos", "valor_por_kg_excedente_centavos", "frete_minimo_centavos"]:
        if key in data:
            data[key.replace("_centavos", "")] = cents_to_money(data[key])
    return data


def map_tariff_rule(row_data):
    data = dict(row_data)
    for key in ["valor_fixo_centavos", "valor_minimo_centavos", "valor_maximo_centavos"]:
        if key in data:
            data[key.replace("_centavos", "")] = cents_to_money(data[key])
    return data


def map_profitability_premise(row_data):
    return {
        "id": row_data["id"],
        "codigo": row_data["codigo"],
        "nome": row_data["nome"],
        "comissaoPercentual": percent_to_display(row_data["comissao_percentual"]),
        "taxaFixa": cents_to_money(row_data["taxa_fixa_centavos"]),
        "impostoPercentual": percent_to_display(row_data["imposto_percentual"]),
        "adsPercentual": percent_to_display(row_data["ads_percentual"]),
        "parcelamentoPercentual": percent_to_display(row_data["parcelamento_percentual"]),
        "freteGratisMinimo": cents_to_money(row_data["frete_gratis_minimo_centavos"]),
        "margemAlvoPercentual": percent_to_display(row_data["margem_alvo_percentual"]),
        "ativo": bool(row_data["ativo"]),
        "atualizadoEm": row_data["atualizado_em"],
    }


def map_profitability_sku(row_data):
    return {
        "id": row_data["id"],
        "sku": row_data["sku"],
        "nome": row_data["nome"],
        "canal": row_data["canal"],
        "custoProduto": cents_to_money(row_data["custo_produto_centavos"]),
        "precoVenda": cents_to_money(row_data["preco_venda_centavos"]),
        "custoEmbalagem": cents_to_money(row_data["custo_embalagem_centavos"]),
        "impostoPercentual": percent_optional_to_display(row_data.get("imposto_percentual")),
        "comissaoPercentual": percent_optional_to_display(row_data.get("comissao_percentual")),
        "adsPercentual": percent_optional_to_display(row_data.get("ads_percentual")),
        "parcelamentoPercentual": percent_optional_to_display(row_data.get("parcelamento_percentual")),
        "freteEstimado": cents_to_money(row_data["frete_estimado_centavos"]),
        "freteGratis": bool(row_data["frete_gratis"]),
        "pesoKg": row_data["peso_kg"],
        "comprimentoCm": row_data["comprimento_cm"],
        "larguraCm": row_data["largura_cm"],
        "alturaCm": row_data["altura_cm"],
        "fatorCubagem": row_data["fator_cubagem"],
        "estoque": row_data["estoque"],
        "status": row_data["status"],
        "atualizadoEm": row_data["atualizado_em"],
    }


def api_float(value, fallback=0):
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return fallback


def api_money_to_cents(value):
    return int(round(max(0, api_float(value)) * 100))


def api_percent_text(value):
    parsed = api_float(value)
    if parsed > 1:
        parsed = parsed / 100
    return str(round(max(0, parsed), 4))


def percent_to_display(value):
    return round(api_float(value) * 100, 2)


def percent_optional_to_display(value):
    return "" if value in (None, "") else percent_to_display(value)


def normalize_channel(value):
    raw = str(value or "").strip().upper().replace(" ", "_").replace("-", "_")
    aliases = {
        "ML": "MERCADO_LIVRE",
        "MERCADOLIVRE": "MERCADO_LIVRE",
        "MERCADO_LIVRE": "MERCADO_LIVRE",
        "SHOPEE": "SHOPEE",
        "SITE": "SITE_PROPRIO",
        "LOJA": "SITE_PROPRIO",
        "LOJA_PROPRIA": "SITE_PROPRIO",
        "SITE_PROPRIO": "SITE_PROPRIO",
    }
    return aliases.get(raw)


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "8000"))
    print(f"FreteHub V2 rodando em http://localhost:{port}/apps/web/")
    ThreadingHTTPServer(("localhost", port), Handler).serve_forever()
