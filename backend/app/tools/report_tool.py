def build_report(data: dict) -> dict:
    return {"type":"report", "message":"Relatório estruturado preparado localmente.", "sections":list(data.keys())}
