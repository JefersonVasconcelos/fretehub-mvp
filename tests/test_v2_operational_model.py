import os
import sys
import unittest


ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(ROOT, "server"))

from fretehub.database import init_db, row, rows
from fretehub.permissions import can


class V2OperationalModelTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_migrations_are_registered(self):
        applied = rows("SELECT version FROM schema_migrations")
        self.assertTrue(any(item["version"] == "20260704_001_modelo_operacional" for item in applied))
        self.assertTrue(any(item["version"] == "20260704_002_usuarios_operacionais" for item in applied))

    def test_profiles_and_user_profiles_seed(self):
        self.assertEqual(row("SELECT COUNT(*) total FROM perfis")["total"], 5)
        self.assertGreaterEqual(row("SELECT COUNT(*) total FROM usuario_perfis")["total"], 5)

    def test_carrier_services_contracts_and_tariff_tables_seed(self):
        self.assertGreaterEqual(row("SELECT COUNT(*) total FROM servicos_transportadora")["total"], 6)
        self.assertGreaterEqual(row("SELECT COUNT(*) total FROM contratos_transportadora")["total"], 3)
        self.assertGreaterEqual(row("SELECT COUNT(*) total FROM tabelas_tarifa")["total"], 3)
        self.assertGreaterEqual(row("SELECT COUNT(*) total FROM faixas_tarifa")["total"], 3)
        self.assertGreaterEqual(row("SELECT COUNT(*) total FROM regras_adicionais_tarifa")["total"], 6)

    def test_imports_integration_logs_and_history_seed(self):
        self.assertEqual(row("SELECT COUNT(*) total FROM importacoes")["total"], 2)
        self.assertGreaterEqual(row("SELECT COUNT(*) total FROM logs_integracao")["total"], 3)
        self.assertGreaterEqual(row("SELECT COUNT(*) total FROM historico_status_pedido")["total"], 10)

    def test_permission_matrix(self):
        admin = {"perfil": "Administrador", "perfis": ["Administrador"]}
        consulta = {"perfil": "Consulta", "perfis": ["Consulta"]}
        operador = {"perfil": "Operador de Frete", "perfis": ["Operador de Frete"]}

        self.assertTrue(can(admin, "tariff:manage"))
        self.assertTrue(can(operador, "quote:create"))
        self.assertTrue(can(consulta, "read"))
        self.assertFalse(can(consulta, "quote:create"))


if __name__ == "__main__":
    unittest.main()
