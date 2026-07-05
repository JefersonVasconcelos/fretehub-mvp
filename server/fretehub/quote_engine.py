from datetime import date


def only_digits(value):
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def validate_quote_params(params):
    errors = []
    if not only_digits(params.get("cepOrigem")):
        errors.append("CEP origem e obrigatorio.")
    if not only_digits(params.get("cepDestino")):
        errors.append("CEP destino e obrigatorio.")
    if float(params.get("pesoRealKg") or 0) <= 0:
        errors.append("Peso real deve ser maior que zero.")
    for key in ("comprimentoCm", "larguraCm", "alturaCm"):
        if float(params.get(key) or 0) <= 0:
            errors.append("Dimensoes devem ser maiores que zero.")
            break
    if float(params.get("valorDeclarado") or 0) <= 0:
        errors.append("Valor declarado deve ser maior que zero.")
    if int(params.get("volumes") or 0) < 1:
        errors.append("Volume deve ser maior ou igual a 1.")
    return errors


def calculate_quote(params, carriers, rates):
    errors = validate_quote_params(params)
    if errors:
        return {"errors": errors, "options": []}

    enabled = set(params.get("transportadorasHabilitadas") or [c["id"] for c in carriers])
    today = date.today().isoformat()
    options = []
    peso_cubado_max = 0
    peso_considerado_max = 0

    for carrier in carriers:
        if carrier["id"] not in enabled:
            continue
        fator = float(carrier.get("fatorCubagem") or 300)
        peso_cubado = (
            float(params["comprimentoCm"])
            * float(params["larguraCm"])
            * float(params["alturaCm"])
            / fator
            * int(params["volumes"])
        )
        peso_real = float(params["pesoRealKg"])
        peso_considerado = max(peso_real, peso_cubado)
        peso_cubado_max = max(peso_cubado_max, peso_cubado)
        peso_considerado_max = max(peso_considerado_max, peso_considerado)

        if carrier.get("status") != "Ativa":
            options.append(_unavailable(carrier, peso_real, peso_cubado, peso_considerado, "Transportadora inativa."))
            continue

        carrier_rates = [r for r in rates if r["transportadoraId"] == carrier["id"]]
        rate = next((r for r in carrier_rates if _rate_matches(r, params, peso_considerado, today)), None)
        if not rate:
            options.append(_unavailable(carrier, peso_real, peso_cubado, peso_considerado, _explain_no_rate(carrier_rates, params, peso_considerado, today)))
            continue

        kg = max(0, peso_considerado - float(rate["pesoInicioKg"]))
        valor_base = float(rate["taxaFixa"]) + kg * float(rate["kgExcedente"])
        valor_taxas = (
            valor_base * float(rate["combustivelPercentual"])
            + float(params["valorDeclarado"]) * float(rate["seguroPercentual"])
            + float(params["valorDeclarado"]) * float(rate["riscoPercentual"])
            + float(rate["interiorValor"])
            + float(rate["pedagioValor"])
        )
        valor_frete = max(valor_base + valor_taxas, float(rate["minimoFrete"]))
        if float(rate.get("maximoFrete") or 0) > 0:
            valor_frete = min(valor_frete, float(rate["maximoFrete"]))

        options.append({
            "transportadoraId": carrier["id"],
            "transportadoraNome": carrier["nomeFantasia"],
            "tarifaId": rate["id"],
            "modalidade": rate["modalidade"],
            "pesoRealKg": round(peso_real, 2),
            "pesoCubadoKg": round(peso_cubado, 2),
            "pesoConsideradoKg": round(peso_considerado, 2),
            "valorBase": round(valor_base, 2),
            "valorTaxas": round(valor_taxas, 2),
            "valorFrete": round(valor_frete, 2),
            "prazoDias": int(rate["prazoDias"]),
            "disponivel": True,
            "statusTarifa": rate["status"],
            "regrasAplicadas": [
                "Peso cubado aplicado" if peso_cubado > peso_real else "Peso real aplicado",
                rate.get("regrasAdicionais") or "",
            ],
            "motivoIndisponibilidade": "",
            "recomendada": False,
            "motivoRecomendacao": "",
        })

    _mark_recommended(options, params.get("prioridade") or "menor_custo")
    return {
        "errors": [],
        "pesoCubadoMax": round(peso_cubado_max, 2),
        "pesoConsideradoMax": round(peso_considerado_max, 2),
        "options": options,
    }


def _rate_matches(rate, params, peso, today):
    cep = int(only_digits(params.get("cepDestino")).ljust(8, "0"))
    return (
        rate["status"] == "Ativa"
        and rate["vigenciaInicio"] <= today <= rate["vigenciaFim"]
        and rate["ufOrigem"] == "BA"
        and rate["ufDestino"] == params["ufDestino"]
        and int(rate["cepInicio"]) <= cep <= int(rate["cepFim"])
        and float(rate["pesoInicioKg"]) <= peso <= float(rate["pesoFimKg"])
    )


def _explain_no_rate(rates, params, peso, today):
    if not rates:
        return "Nenhuma tarifa cadastrada."
    if all(r["status"] != "Ativa" for r in rates):
        return "Tarifa pendente, vencida ou cancelada."
    if all(r["vigenciaInicio"] > today or r["vigenciaFim"] < today for r in rates):
        return "Nenhuma tarifa vigente."
    if all(r["ufDestino"] != params["ufDestino"] for r in rates):
        return "UF de destino nao atendida."
    cep = int(only_digits(params.get("cepDestino")).ljust(8, "0"))
    if all(cep < int(r["cepInicio"]) or cep > int(r["cepFim"]) for r in rates):
        return "CEP fora da area atendida."
    if all(peso < float(r["pesoInicioKg"]) or peso > float(r["pesoFimKg"]) for r in rates):
        return "Peso fora da faixa."
    return "Nenhuma tarifa valida para esta combinacao."


def _unavailable(carrier, peso_real, peso_cubado, peso_considerado, reason):
    return {
        "transportadoraId": carrier["id"],
        "transportadoraNome": carrier["nomeFantasia"],
        "tarifaId": "",
        "modalidade": "-",
        "pesoRealKg": round(peso_real, 2),
        "pesoCubadoKg": round(peso_cubado, 2),
        "pesoConsideradoKg": round(peso_considerado, 2),
        "valorFrete": 0,
        "valorTaxas": 0,
        "prazoDias": 0,
        "disponivel": False,
        "statusTarifa": "Indisponivel",
        "regrasAplicadas": [],
        "motivoIndisponibilidade": reason,
        "recomendada": False,
        "motivoRecomendacao": "",
    }


def _mark_recommended(options, priority):
    available = [o for o in options if o["disponivel"]]
    if not available:
        return
    if priority == "menor_prazo":
        best = min(available, key=lambda o: o["prazoDias"])
        reason = "Menor prazo entre as opcoes disponiveis."
    elif priority == "equilibrio":
        best = min(available, key=lambda o: o["valorFrete"] * o["prazoDias"])
        reason = "Melhor equilibrio entre custo e prazo."
    else:
        best = min(available, key=lambda o: o["valorFrete"])
        reason = "Menor custo entre as opcoes disponiveis."
    best["recomendada"] = True
    best["motivoRecomendacao"] = reason
