import os
import sys
import unittest
import uuid


ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(ROOT, "server"))

from app import Handler, map_user
from fretehub.database import init_db, row, rows


class UserManagementApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def call_handler(self, method, body=None, *args):
        handler = object.__new__(Handler)
        captured = {}

        def body_json(limit=1_000_000):
            return body or {}

        def json_response(data, status=200):
            captured["data"] = data
            captured["status"] = status
            return data

        def error_response(status, message):
            return json_response({"error": message}, status)

        handler.body_json = body_json
        handler.json = json_response
        handler.error = error_response
        method(handler, *args)
        return captured

    def test_admin_can_create_and_delete_user(self):
        actor = map_user(row("SELECT * FROM users WHERE email = ?", ("admin@salvadorcomercial.com.br",)))
        email = f"novo-{uuid.uuid4().hex[:8]}@teste.local"

        created_response = self.call_handler(
            Handler.create_user,
            {
                "nome": "Usuario Teste",
                "email": email,
                "telefone": "(71) 99999-0000",
                "senha": "Senha123!",
                "perfilId": "perfil-operador",
            },
            actor,
        )

        self.assertEqual(created_response["status"], 201)
        created = created_response["data"]
        self.assertEqual(created["email"], email)
        self.assertIn("Operador de Frete", created["perfis"])
        self.assertEqual(row("SELECT status FROM users WHERE id = ?", (created["id"],))["status"], "Ativo")

        listed_users = rows("SELECT * FROM users WHERE excluido_em IS NULL ORDER BY nome")
        self.assertTrue(any(user["email"] == email for user in listed_users))

        deleted_response = self.call_handler(Handler.delete_user, {}, actor, created["id"])
        self.assertEqual(deleted_response["status"], 200)
        self.assertTrue(deleted_response["data"]["ok"])

        deleted = row("SELECT status, ativo, excluido_em FROM users WHERE id = ?", (created["id"],))
        self.assertEqual(deleted["status"], "Inativo")
        self.assertEqual(deleted["ativo"], 0)
        self.assertIsNotNone(deleted["excluido_em"])

        login_response = self.call_handler(
            Handler.login,
            {"email": email, "password": "Senha123!"},
        )
        self.assertEqual(login_response["status"], 401)

    def test_admin_cannot_delete_itself(self):
        actor = map_user(row("SELECT * FROM users WHERE email = ?", ("admin@salvadorcomercial.com.br",)))
        response = self.call_handler(Handler.delete_user, {}, actor, actor["id"])
        self.assertEqual(response["status"], 400)
        self.assertIn("proprio usuario", response["data"]["error"])

    def test_admin_can_duplicate_and_update_tariff(self):
        actor = map_user(row("SELECT * FROM users WHERE email = ?", ("admin@salvadorcomercial.com.br",)))
        source = row("SELECT * FROM tabelas_tarifa ORDER BY criado_em LIMIT 1")

        duplicated_response = self.call_handler(Handler.duplicate_tariff_table, {}, actor, source["id"])
        self.assertEqual(duplicated_response["status"], 201)
        duplicated_id = duplicated_response["data"]["id"]

        duplicated = row("SELECT * FROM tabelas_tarifa WHERE id = ?", (duplicated_id,))
        self.assertEqual(duplicated["status"], "EM_APROVACAO")
        self.assertGreater(duplicated["versao"], source["versao"])
        self.assertGreater(row("SELECT COUNT(*) total FROM faixas_tarifa WHERE tabela_tarifa_id = ?", (duplicated_id,))["total"], 0)

        updated_response = self.call_handler(
            Handler.update_tariff_table,
            {
                "nome": "Tarifa teste atualizada",
                "status": "ATIVA",
                "vigenciaInicio": "2026-01-01",
                "vigenciaFim": "2026-12-31",
                "pesoMinimoKg": 1,
                "pesoMaximoKg": 25,
                "prazoDias": 6,
            },
            actor,
            duplicated_id,
        )
        self.assertEqual(updated_response["status"], 200)
        updated = row("SELECT nome, status, data_inicio_vigencia, data_fim_vigencia FROM tabelas_tarifa WHERE id = ?", (duplicated_id,))
        self.assertEqual(updated["nome"], "Tarifa teste atualizada")
        self.assertEqual(updated["status"], "ATIVA")
        updated_range = row("SELECT peso_minimo_kg, peso_maximo_kg, prazo_dias FROM faixas_tarifa WHERE tabela_tarifa_id = ? LIMIT 1", (duplicated_id,))
        self.assertEqual(updated_range["peso_minimo_kg"], 1)
        self.assertEqual(updated_range["peso_maximo_kg"], 25)
        self.assertEqual(updated_range["prazo_dias"], 6)

    def test_admin_can_create_tariff(self):
        actor = map_user(row("SELECT * FROM users WHERE email = ?", ("admin@salvadorcomercial.com.br",)))
        carrier = row("SELECT * FROM carriers WHERE status = 'Ativa' LIMIT 1")
        service = row("SELECT * FROM servicos_transportadora WHERE transportadora_id = ? LIMIT 1", (carrier["id"],))
        contract = row("SELECT * FROM contratos_transportadora WHERE transportadora_id = ? AND status = 'ATIVO' LIMIT 1", (carrier["id"],))

        response = self.call_handler(
            Handler.create_tariff_table,
            {
                "nome": f"Tarifa nova teste {uuid.uuid4().hex[:6]}",
                "transportadoraId": carrier["id"],
                "servicoId": service["id"],
                "contratoId": contract["id"],
                "status": "RASCUNHO",
                "ufOrigem": "BA",
                "ufDestino": "SE",
                "vigenciaInicio": "2026-01-01",
                "vigenciaFim": "2026-12-31",
                "cepInicio": "49000000",
                "cepFim": "49999999",
                "pesoMinimoKg": 0,
                "pesoMaximoKg": 30,
                "prazoDias": 4,
                "valorFreteBase": 22.5,
                "valorKgExcedente": 1.2,
                "freteMinimo": 35,
            },
            actor,
        )

        self.assertEqual(response["status"], 201)
        created_id = response["data"]["id"]
        created = row("SELECT * FROM tabelas_tarifa WHERE id = ?", (created_id,))
        self.assertEqual(created["status"], "RASCUNHO")
        self.assertEqual(created["transportadora_id"], carrier["id"])
        created_range = row("SELECT * FROM faixas_tarifa WHERE tabela_tarifa_id = ?", (created_id,))
        self.assertEqual(created_range["uf_destino"], "SE")
        self.assertEqual(created_range["valor_frete_base_centavos"], 2250)
        self.assertEqual(created_range["frete_minimo_centavos"], 3500)

    def test_admin_can_create_and_update_carrier(self):
        actor = map_user(row("SELECT * FROM users WHERE email = ?", ("admin@salvadorcomercial.com.br",)))
        suffix = uuid.uuid4().hex[:6]

        created_response = self.call_handler(
            Handler.create_carrier,
            {
                "nomeFantasia": f"Transportadora Teste {suffix}",
                "razaoSocial": f"Transportadora Teste {suffix} LTDA",
                "cnpj": "11.222.333/0001-44",
                "status": "Ativa",
                "fatorCubagem": 300,
                "modalidades": ["Rodoviario", "Fracionado"],
                "estadosAtendidos": ["BA", "SE"],
                "prazoMedioDias": 4,
                "contrato": f"CTR-TESTE-{suffix}",
                "observacoes": "Criada por teste automatizado.",
            },
            actor,
        )
        self.assertEqual(created_response["status"], 201)
        created = created_response["data"]
        self.assertEqual(created["nomeFantasia"], f"Transportadora Teste {suffix}")
        self.assertIn("SE", created["estadosAtendidos"])

        updated_response = self.call_handler(
            Handler.update_carrier,
            {
                "nomeFantasia": f"Transportadora Editada {suffix}",
                "razaoSocial": f"Transportadora Editada {suffix} SA",
                "cnpj": "11.222.333/0001-44",
                "status": "Inativa",
                "fatorCubagem": 250,
                "modalidades": ["Expresso"],
                "estadosAtendidos": ["BA", "PE"],
                "prazoMedioDias": 2,
                "contrato": f"CTR-EDIT-{suffix}",
                "observacoes": "Editada por teste automatizado.",
            },
            actor,
            created["id"],
        )
        self.assertEqual(updated_response["status"], 200)
        updated = updated_response["data"]
        self.assertEqual(updated["nomeFantasia"], f"Transportadora Editada {suffix}")
        self.assertEqual(updated["status"], "Inativa")
        self.assertEqual(updated["fatorCubagem"], 250)
        self.assertEqual(updated["modalidades"], ["Expresso"])

    def test_admin_can_save_and_test_integration(self):
        actor = map_user(row("SELECT * FROM users WHERE email = ?", ("admin@salvadorcomercial.com.br",)))
        saved_response = self.call_handler(
            Handler.save_integration,
            {
                "id": "protheus",
                "baseUrl": "https://protheus.homolog.local/api",
                "ambiente": "Homologação",
                "authType": "OAuth 2.0",
                "frequenciaMin": 10,
                "usuario": "integracao_frete",
                "senha": "senha-demo",
                "ativa": True,
            },
            actor,
        )

        self.assertEqual(saved_response["status"], 200)
        self.assertEqual(saved_response["data"]["baseUrl"], "https://protheus.homolog.local/api")
        self.assertEqual(saved_response["data"]["credentials"]["frequenciaMin"], 10)

        tested_response = self.call_handler(Handler.test_integration, {"id": "protheus"})
        self.assertEqual(tested_response["status"], 200)
        self.assertEqual(tested_response["data"]["status"], "Conectado")
        self.assertIn("Protheus", tested_response["data"]["lastMessage"])

    def test_admin_can_save_toggle_and_sync_channel(self):
        actor = map_user(row("SELECT * FROM users WHERE email = ?", ("admin@salvadorcomercial.com.br",)))
        channel = row("SELECT * FROM canais_venda WHERE codigo = 'MERCADO_LIVRE'")

        saved_response = self.call_handler(
            Handler.save_channel,
            {
                "clientId": "ML_APP_TESTE",
                "clientSecret": "secret-teste",
                "frequenciaMin": 12,
            },
            actor,
            channel["id"],
        )
        self.assertEqual(saved_response["status"], 200)
        self.assertEqual(saved_response["data"]["clientId"], "ML_APP_TESTE")
        self.assertEqual(saved_response["data"]["frequenciaMin"], 12)

        before_toggle = row("SELECT ativo FROM canais_venda WHERE id = ?", (channel["id"],))["ativo"]
        toggled_response = self.call_handler(Handler.toggle_channel, {}, actor, channel["id"])
        self.assertEqual(toggled_response["status"], 200)
        self.assertNotEqual(toggled_response["data"]["ativo"], bool(before_toggle))
        self.call_handler(Handler.toggle_channel, {}, actor, channel["id"])

        sync_response = self.call_handler(Handler.sync_channel, {}, actor, channel["id"])
        self.assertEqual(sync_response["status"], 200)
        self.assertIn("Mercado Livre", sync_response["data"]["message"])
        self.assertGreater(row("SELECT COUNT(*) total FROM logs_integracao WHERE integracao_id = 'int-ml'")["total"], 0)


if __name__ == "__main__":
    unittest.main()
