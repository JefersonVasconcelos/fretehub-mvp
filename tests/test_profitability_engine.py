import os
import sys
import unittest


ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(ROOT, "server"))

from fretehub.profitability_engine import calculate_profitability


class ProfitabilityEngineTest(unittest.TestCase):
    def setUp(self):
        self.premise = {
            "codigo": "MERCADO_LIVRE",
            "comissaoPercentual": 16,
            "taxaFixa": 6,
            "impostoPercentual": 8,
            "adsPercentual": 4,
            "parcelamentoPercentual": 2,
            "margemAlvoPercentual": 15,
        }

    def test_calculates_minimum_price_and_healthy_score(self):
        sku = {
            "sku": "SKU-OK",
            "canal": "MERCADO_LIVRE",
            "custoProduto": 32,
            "precoVenda": 119.9,
            "custoEmbalagem": 3,
            "freteEstimado": 14,
            "freteGratis": True,
            "pesoKg": 1.2,
            "comprimentoCm": 12,
            "larguraCm": 10,
            "alturaCm": 4,
            "fatorCubagem": 300,
        }

        result = calculate_profitability(sku, self.premise)

        self.assertGreater(result["lucroEstimado"], 0)
        self.assertGreater(result["precoVenda"], result["precoMinimo"])
        self.assertGreaterEqual(result["score"], 75)
        self.assertIn("Saudavel", result["alertas"])

    def test_flags_loss_and_cubic_risk(self):
        sku = {
            "sku": "SKU-RISCO",
            "canal": "MERCADO_LIVRE",
            "custoProduto": 60,
            "precoVenda": 79.9,
            "custoEmbalagem": 4,
            "freteEstimado": 31,
            "freteGratis": True,
            "pesoKg": 0.7,
            "comprimentoCm": 45,
            "larguraCm": 32,
            "alturaCm": 20,
            "fatorCubagem": 300,
        }

        result = calculate_profitability(sku, self.premise)

        self.assertLess(result["lucroEstimado"], 0)
        self.assertIn("Prejuizo estimado", result["alertas"])
        self.assertIn("Risco por cubagem", result["alertas"])
        self.assertLess(result["score"], 30)


if __name__ == "__main__":
    unittest.main()
