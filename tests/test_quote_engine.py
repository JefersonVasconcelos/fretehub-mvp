import os
import sys
import unittest
from datetime import date, timedelta


ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(ROOT, "server"))

from fretehub.quote_engine import calculate_quote


def future(days):
    return (date.today() + timedelta(days=days)).isoformat()


class QuoteEngineTest(unittest.TestCase):
    def setUp(self):
        self.carriers = [
            {"id": "t1", "nomeFantasia": "Rapida", "status": "Ativa", "fatorCubagem": 300},
            {"id": "t2", "nomeFantasia": "Barata", "status": "Ativa", "fatorCubagem": 300},
            {"id": "t3", "nomeFantasia": "Inativa", "status": "Inativa", "fatorCubagem": 300},
        ]
        self.rates = [
            self.rate("r1", "t1", taxa=30, kg=2.5, prazo=2),
            self.rate("r2", "t2", taxa=20, kg=1.5, prazo=6),
            self.rate("r3", "t3", taxa=10, kg=1.0, prazo=1),
        ]
        self.params = {
            "cepOrigem": "40010000",
            "cepDestino": "01310000",
            "ufDestino": "SP",
            "pesoRealKg": 10,
            "comprimentoCm": 30,
            "larguraCm": 20,
            "alturaCm": 15,
            "volumes": 1,
            "valorDeclarado": 500,
            "prioridade": "menor_custo",
        }

    def rate(self, id_, carrier_id, taxa, kg, prazo, status="Ativa", start=-1, end=30):
        return {
            "id": id_,
            "transportadoraId": carrier_id,
            "modalidade": "Rodoviario",
            "ufOrigem": "BA",
            "ufDestino": "SP",
            "cepInicio": "01000000",
            "cepFim": "19999999",
            "pesoInicioKg": 0,
            "pesoFimKg": 100,
            "taxaFixa": taxa,
            "kgExcedente": kg,
            "combustivelPercentual": 0,
            "riscoPercentual": 0,
            "interiorValor": 0,
            "pedagioValor": 0,
            "seguroPercentual": 0,
            "prazoDias": prazo,
            "minimoFrete": 0,
            "maximoFrete": 0,
            "status": status,
            "vigenciaInicio": future(start),
            "vigenciaFim": future(end),
            "regrasAdicionais": "",
        }

    def test_recommends_lowest_cost(self):
        result = calculate_quote(self.params, self.carriers, self.rates)
        recommended = [o for o in result["options"] if o["recomendada"]][0]
        self.assertEqual(recommended["transportadoraId"], "t2")

    def test_recommends_lowest_deadline(self):
        params = {**self.params, "prioridade": "menor_prazo"}
        result = calculate_quote(params, self.carriers, self.rates)
        recommended = [o for o in result["options"] if o["recomendada"]][0]
        self.assertEqual(recommended["transportadoraId"], "t1")

    def test_cubic_weight_is_applied_when_higher_than_real_weight(self):
        params = {**self.params, "pesoRealKg": 1, "comprimentoCm": 100, "larguraCm": 80, "alturaCm": 60}
        result = calculate_quote(params, self.carriers, self.rates)
        available = [o for o in result["options"] if o["disponivel"]]
        self.assertTrue(all(o["pesoCubadoKg"] > o["pesoRealKg"] for o in available))

    def test_inactive_carrier_is_unavailable(self):
        result = calculate_quote(self.params, self.carriers, self.rates)
        inactive = [o for o in result["options"] if o["transportadoraId"] == "t3"][0]
        self.assertFalse(inactive["disponivel"])
        self.assertIn("inativa", inactive["motivoIndisponibilidade"].lower())

    def test_expired_rate_is_not_available(self):
        rates = [self.rate("r1", "t1", taxa=30, kg=2.5, prazo=2, start=-30, end=-1)]
        result = calculate_quote(self.params, [self.carriers[0]], rates)
        self.assertFalse(result["options"][0]["disponivel"])
        self.assertIn("vigente", result["options"][0]["motivoIndisponibilidade"])

    def test_validation_errors(self):
        params = {**self.params, "pesoRealKg": 0}
        result = calculate_quote(params, self.carriers, self.rates)
        self.assertTrue(result["errors"])


if __name__ == "__main__":
    unittest.main()
