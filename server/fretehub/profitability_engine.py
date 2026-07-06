def calculate_profitability(sku, premise):
    price = money(sku.get("precoVenda"))
    product_cost = money(sku.get("custoProduto"))
    packaging_cost = money(sku.get("custoEmbalagem"))
    fixed_fee = money(premise.get("taxaFixa"))
    freight_cost = money(sku.get("freteEstimado")) if sku.get("freteGratis") else 0
    commission_pct = percent(sku.get("comissaoPercentual"), premise.get("comissaoPercentual"))
    tax_pct = percent(sku.get("impostoPercentual"), premise.get("impostoPercentual"))
    ads_pct = percent(sku.get("adsPercentual"), premise.get("adsPercentual"))
    installment_pct = percent(sku.get("parcelamentoPercentual"), premise.get("parcelamentoPercentual"))
    target_margin = percent(sku.get("margemAlvoPercentual"), premise.get("margemAlvoPercentual"), 0.15)
    variable_pct = commission_pct + tax_pct + ads_pct + installment_pct
    variable_cost = price * variable_pct
    total_cost = product_cost + packaging_cost + fixed_fee + freight_cost + variable_cost
    profit = price - total_cost
    margin = profit / price if price > 0 else 0
    denominator = 1 - variable_pct - target_margin
    minimum_price = (product_cost + packaging_cost + fixed_fee + freight_cost) / denominator if denominator > 0 else 0
    cubic_weight = cubic(sku)
    real_weight = number(sku.get("pesoKg"))
    cubic_alert = cubic_weight > real_weight * 1.35 and cubic_weight > 0
    score = profitability_score(margin, target_margin, profit, cubic_alert)
    alerts = build_alerts(profit, margin, target_margin, cubic_alert, sku, freight_cost)
    return {
        "sku": sku.get("sku"),
        "canal": sku.get("canal"),
        "precoVenda": round(price, 2),
        "precoMinimo": round(minimum_price, 2),
        "custoTotal": round(total_cost, 2),
        "lucroEstimado": round(profit, 2),
        "margemPercentual": round(margin * 100, 2),
        "score": score,
        "pesoRealKg": round(real_weight, 2),
        "pesoCubadoKg": round(cubic_weight, 2),
        "freteGratisImpacto": round(freight_cost, 2),
        "alertas": alerts,
        "acaoRecomendada": recommended_action(profit, margin, target_margin, cubic_alert, price, minimum_price),
    }


def money(value):
    return max(0, number(value))


def number(value, fallback=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def percent(value, fallback=None, default=0):
    raw = fallback if value in (None, "") else value
    if raw in (None, ""):
        return default
    parsed = number(raw)
    return parsed / 100 if parsed > 1 else parsed


def cubic(sku):
    factor = number(sku.get("fatorCubagem"), 300) or 300
    return (
        number(sku.get("comprimentoCm"))
        * number(sku.get("larguraCm"))
        * number(sku.get("alturaCm"))
        / factor
    )


def profitability_score(margin, target_margin, profit, cubic_alert):
    if profit < 0:
        base = 15
    elif margin >= target_margin + 0.08:
        base = 92
    elif margin >= target_margin:
        base = 78
    elif margin >= target_margin * 0.55:
        base = 58
    else:
        base = 35
    if cubic_alert:
        base -= 12
    return max(0, min(100, base))


def build_alerts(profit, margin, target_margin, cubic_alert, sku, freight_cost):
    alerts = []
    if profit < 0:
        alerts.append("Prejuizo estimado")
    if margin < target_margin:
        alerts.append("Margem abaixo da meta")
    if cubic_alert:
        alerts.append("Risco por cubagem")
    if sku.get("freteGratis") and freight_cost > money(sku.get("precoVenda")) * 0.25:
        alerts.append("Frete gratis consome mais de 25% do preco")
    return alerts or ["Saudavel"]


def recommended_action(profit, margin, target_margin, cubic_alert, price, minimum_price):
    if profit < 0:
        return "Aumentar preco, remover frete gratis ou pausar SKU"
    if cubic_alert:
        return "Revisar embalagem e testar caixa menor"
    if margin < target_margin:
        return f"Reajustar preco para pelo menos R$ {minimum_price:.2f}"
    if price > minimum_price * 1.35:
        return "Manter margem e avaliar campanha controlada"
    return "Manter preco e monitorar"
