"""Apoio Python do MCP oss-relatorios (chamado por documentos.js via execFile, sem shell).

  prestacoes <ano>            lista PDFs de oss/<ano> com a MESMA classificacao do vault (convert_prestacao.classify)
  xlsx <arquivo> [aba]        sem aba: lista abas; com aba: linhas da aba (valores calculados)
  xlsx_busca <arquivo> <re>   celulas cujo texto casa com a regex, em todas as abas
Saida: JSON em stdout (UTF-8).
"""
import csv
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
VAULT_DIR = RAIZ / "prestacao-vault"


def out(obj):
    sys.stdout.buffer.write(json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8"))


def prestacoes(ano):
    sys.path.insert(0, str(VAULT_DIR))
    try:
        import requests  # noqa: F401
    except ImportError:  # convert_prestacao exige no import, mas classify/dest_md nao usam
        import types
        sys.modules["requests"] = types.ModuleType("requests")
    import convert_prestacao as cp  # reuso: regra unica de unidade/mes/tipo do vault

    umap, _ = cp.load_units()
    paginas = {}
    if cp.MANIFEST.exists():
        with open(cp.MANIFEST, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                if r.get("paginas") not in (None, "", "0"):
                    paginas[r["origem"]] = int(r["paginas"])
    base = RAIZ / ano
    lista = []
    for f in sorted(base.rglob("*")) if base.is_dir() else []:
        if not f.is_file() or f.suffix.lower() != ".pdf":
            continue
        info = cp.classify(f, umap)
        md = cp.dest_md(info, f.stem)
        lista.append({
            "origem": info["origem"], "unidade": info["unidade"], "mes": info["mes"], "tipo": info["tipo"],
            "subpasta": "/".join(info.get("subdirs", [])), "paginas": paginas.get(info["origem"]),
            "mb": round(f.stat().st_size / 1e6, 1), "md": md.relative_to(RAIZ).as_posix() if md.exists() else None,
        })
    out(lista)


def _wb(arquivo):
    import openpyxl
    return openpyxl.load_workbook(arquivo, data_only=True, read_only=True)


def xlsx(arquivo, aba=None):
    wb = _wb(arquivo)
    if not aba:
        out([{"aba": ws.title, "dimensao": ws.calculate_dimension()} for ws in wb.worksheets])
        return
    if aba not in wb.sheetnames:
        raise SystemExit(f"aba inexistente: {aba}. Abas: {', '.join(wb.sheetnames)}")
    linhas = [list(r) for r in wb[aba].iter_rows(values_only=True)]
    linhas = [r for r in linhas if any(v is not None and str(v).strip() for v in r)]
    out(linhas)


def xlsx_busca(arquivo, padrao):
    rx = re.compile(padrao)
    achados = []
    for ws in _wb(arquivo).worksheets:
        for row in ws.iter_rows():
            for c in row:
                if c.value is not None and rx.search(str(c.value)):
                    achados.append({"aba": ws.title, "celula": c.coordinate, "valor": str(c.value)[:300]})
    out(achados)


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    {"prestacoes": prestacoes, "xlsx": xlsx, "xlsx_busca": xlsx_busca}[cmd](*args)
