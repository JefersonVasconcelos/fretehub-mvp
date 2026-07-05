import base64
import io
import json
import uuid
import zipfile
from xml.etree import ElementTree as ET


NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def read_xlsx_base64(encoded):
    data = base64.b64decode(encoded)
    return read_xlsx_bytes(data)


def read_xlsx_bytes(data):
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        shared_strings = _shared_strings(zf)
        sheet_name = "xl/worksheets/sheet1.xml"
        root = ET.fromstring(zf.read(sheet_name))
        rows = []
        for row in root.findall(".//a:sheetData/a:row", NS):
            values = []
            for cell in row.findall("a:c", NS):
                values.append(_cell_value(cell, shared_strings))
            rows.append(values)
    if not rows:
        return []
    headers = [str(h).strip() for h in rows[0]]
    records = []
    for raw in rows[1:]:
        if not any(str(v).strip() for v in raw):
            continue
        item = {headers[i]: raw[i] if i < len(raw) else "" for i in range(len(headers))}
        records.append(item)
    return records


def import_orders(conn, records):
    required = {"numero", "canal", "cliente", "cep_destino", "uf_destino", "valor_pedido", "peso_real_kg"}
    imported = 0
    errors = []
    for index, record in enumerate(records, start=2):
        missing = [field for field in required if not str(record.get(field, "")).strip()]
        if missing:
            errors.append({"linha": index, "erro": f"Campos obrigatorios ausentes: {', '.join(missing)}"})
            continue
        try:
            conn.execute(
                """
                INSERT OR REPLACE INTO orders
                (id, numero, canal, cliente, cep_origem, cep_destino, cidade_destino, uf_destino, valor_pedido, peso_real_kg,
                 comprimento_cm, largura_cm, altura_cm, volumes, produtos, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(record.get("id") or f"imp-{uuid.uuid4().hex[:10]}"),
                    str(record["numero"]),
                    str(record["canal"]),
                    str(record["cliente"]),
                    str(record.get("cep_origem") or "40010000"),
                    str(record["cep_destino"]),
                    str(record.get("cidade_destino") or ""),
                    str(record["uf_destino"]).upper(),
                    float(record["valor_pedido"]),
                    float(record["peso_real_kg"]),
                    float(record.get("comprimento_cm") or 30),
                    float(record.get("largura_cm") or 20),
                    float(record.get("altura_cm") or 15),
                    int(float(record.get("volumes") or 1)),
                    str(record.get("produtos") or ""),
                    str(record.get("status") or "Aguardando Cotacao"),
                ),
            )
            imported += 1
        except Exception as exc:
            errors.append({"linha": index, "erro": str(exc)})
    return {"imported": imported, "errors": errors}


def import_rates(conn, records):
    required = {"nome", "transportadora_id", "modalidade", "uf_destino", "cep_inicio", "cep_fim", "taxa_fixa", "kg_excedente"}
    imported = 0
    errors = []
    for index, record in enumerate(records, start=2):
        missing = [field for field in required if not str(record.get(field, "")).strip()]
        if missing:
            errors.append({"linha": index, "erro": f"Campos obrigatorios ausentes: {', '.join(missing)}"})
            continue
        try:
            conn.execute(
                """
                INSERT OR REPLACE INTO rates
                (id, nome, transportadora_id, modalidade, uf_origem, uf_destino, cep_inicio, cep_fim, peso_inicio_kg, peso_fim_kg,
                 taxa_fixa, kg_excedente, combustivel_percentual, risco_percentual, interior_valor, pedagio_valor, seguro_percentual,
                 prazo_dias, minimo_frete, maximo_frete, status, vigencia_inicio, vigencia_fim, regras_adicionais)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(record.get("id") or f"tar-{uuid.uuid4().hex[:10]}"),
                    str(record["nome"]),
                    str(record["transportadora_id"]),
                    str(record["modalidade"]),
                    str(record.get("uf_origem") or "BA"),
                    str(record["uf_destino"]).upper(),
                    str(record["cep_inicio"]),
                    str(record["cep_fim"]),
                    float(record.get("peso_inicio_kg") or 0),
                    float(record.get("peso_fim_kg") or 9999),
                    float(record["taxa_fixa"]),
                    float(record["kg_excedente"]),
                    float(record.get("combustivel_percentual") or 0),
                    float(record.get("risco_percentual") or 0),
                    float(record.get("interior_valor") or 0),
                    float(record.get("pedagio_valor") or 0),
                    float(record.get("seguro_percentual") or 0),
                    int(float(record.get("prazo_dias") or 5)),
                    float(record.get("minimo_frete") or 0),
                    float(record.get("maximo_frete") or 0),
                    str(record.get("status") or "Ativa"),
                    str(record.get("vigencia_inicio") or "2026-01-01"),
                    str(record.get("vigencia_fim") or "2026-12-31"),
                    str(record.get("regras_adicionais") or ""),
                ),
            )
            imported += 1
        except Exception as exc:
            errors.append({"linha": index, "erro": str(exc)})
    return {"imported": imported, "errors": errors}


def _shared_strings(zf):
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    values = []
    for item in root.findall("a:si", NS):
        text = "".join(node.text or "" for node in item.findall(".//a:t", NS))
        values.append(text)
    return values


def _cell_value(cell, shared_strings):
    value_node = cell.find("a:v", NS)
    if value_node is None:
        inline = cell.find(".//a:t", NS)
        return inline.text if inline is not None else ""
    value = value_node.text or ""
    if cell.get("t") == "s":
        return shared_strings[int(value)]
    return value
