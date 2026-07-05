from datetime import datetime


class IntegrationClient:
    name = "generic"

    def __init__(self, config):
        self.config = config

    def test_connection(self):
        credentials = self.config.get("credentials") or {}
        if not self.config.get("baseUrl"):
            return {"ok": False, "message": "Base URL nao configurada."}
        if not credentials:
            return {"ok": False, "message": "Credenciais nao configuradas."}
        return {"ok": True, "message": f"Conector {self.name} pronto para chamada real."}

    def sync_orders(self):
        result = self.test_connection()
        if not result["ok"]:
            return result
        return {"ok": True, "message": "Sincronizacao simulada. Implementar chamada oficial da API."}


class ProtheusClient(IntegrationClient):
    name = "Protheus"


class MercadoLivreClient(IntegrationClient):
    name = "Mercado Livre"


class ShopeeClient(IntegrationClient):
    name = "Shopee"


def client_for(config):
    key = (config.get("id") or "").lower()
    if key == "protheus":
        return ProtheusClient(config)
    if key == "mercadolivre":
        return MercadoLivreClient(config)
    if key == "shopee":
        return ShopeeClient(config)
    return IntegrationClient(config)


def integration_status(config):
    result = client_for(config).test_connection()
    return {
        **config,
        "status": "Conectado" if result["ok"] else "Nao configurado",
        "lastCheckAt": datetime.utcnow().isoformat() + "Z",
        "lastMessage": result["message"],
    }
