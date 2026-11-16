"""Extrai o Demonstrativo Financeiro Consolidado (xlsx da prestação de contas) para <stem>.financeiro.json.

Uso: python src/db/extraiFinanceiro.py <planilha.xlsx | demonstrativo.pdf>...
xlsx: cada aba = <UNIDADE> <CONTA> (ex.: "HMA CUSTEIO", "UPA PROVISÃO").
pdf: impressão de uma aba do mesmo modelo (lida com `pdftotext -table`, xpdf); unidade/conta do "Unidade: X (CONTA)".
Só lê os meses do "Período:". Um JSON por arquivo de entrada.
Saída crua (rótulos como na planilha); classificação e validação ficam em carregaFinanceiro.js.
"""
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import openpyxl

MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO',
         'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']


def sem_acento(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().upper().strip()


def txt(v):
    return str(v).strip() if v is not None else ''


def num(v):
    return round(float(v), 2) if isinstance(v, (int, float)) else 0.0


def ler_aba(ws):
    linhas = [list(r) for r in ws.iter_rows(values_only=True)]
    unidade, conta = sem_acento(ws.title).rsplit(' ', 1)
    out = {'aba': ws.title, 'unidade': unidade, 'conta': conta, 'saldo_anterior': None,
           'receitas': [], 'despesas': [], 'grupos': [], 'total_receitas': None, 'total_despesas': None,
           'movimentos': [], 'saldo': None}
    cab = col_mes = None
    for i, r in enumerate(linhas):
        for j, v in enumerate(r):
            t = sem_acento(txt(v))
            if t.startswith('SALDO MES ANTERIOR'):
                out['saldo_anterior'] = num(next(x for x in r[j + 1:] if x is not None))
            if t.startswith('PERIODO'):
                per = txt(next(x for x in r[j + 1:] if x is not None))
                m = re.match(r'(\d\d)/(\d\d) a (\d\d)/(\d\d)/(\d{4})', per)
                out['ano'], out['mes_ini'], out['mes_fim'] = int(m[5]), int(m[2]), int(m[4])
        if cab is None and txt(r[2]) == 'DESCRIÇÃO DA CONTA':
            cab = i
            col_mes = {txt(v).upper(): j for j, v in enumerate(r) if txt(v).upper() in MESES}
    if cab is None or 'ano' not in out:
        raise SystemExit(f'{ws.title}: cabeçalho/período não encontrado')
    cols = [col_mes[MESES[m - 1]] for m in range(out['mes_ini'], out['mes_fim'] + 1)]
    out['meses'] = [f"{out['ano']}-{m:02d}-01" for m in range(out['mes_ini'], out['mes_fim'] + 1)]
    vals = lambda r: [num(r[c]) for c in cols]  # noqa: E731

    secao = None
    for r in linhas[cab + 1:]:
        a, b, c = txt(r[0]), txt(r[1]), txt(r[2])
        if a in ('RECEITAS', 'DESPESAS'):
            secao = a
            continue
        if secao == 'RECEITAS':
            if c == 'TOTAL':
                out['total_receitas'] = vals(r)
            elif c:
                out['receitas'].append({'nome': c, 'valores': vals(r)})
            # linha com só B (REPASSE / FINANCEIRO - RECEITA) é subtotal; validado pelo TOTAL
        elif secao == 'DESPESAS':
            if re.fullmatch(r'\d+\.0', b):
                out['grupos'].append({'codigo': b, 'nome': c, 'valores': vals(r)})
            elif re.fullmatch(r'\d+\.\d+', b):
                out['despesas'].append({'codigo': b, 'nome': c, 'valores': vals(r)})
            elif not b and not c and isinstance(r[cols[0]], (int, float)):
                out['total_despesas'] = vals(r)
                secao = 'MOVIMENTOS'
        elif secao == 'MOVIMENTOS' and c:
            if sem_acento(c).startswith('SALDO EM CONTA'):
                out['saldo'] = vals(r)
                break
            out['movimentos'].append({'descricao': c, 'valores': vals(r)})
    if out['saldo'] is None or out['total_despesas'] is None:
        raise SystemExit(f'{ws.title}: linha de total de despesas ou saldo não encontrada')
    return out


DINHEIRO = re.compile(r'^-?[\d.]+,\d{2}$')


def ler_pdf(p):
    texto = subprocess.run(['pdftotext', '-table', '-enc', 'UTF-8', str(p), '-'],
                           capture_output=True, check=True).stdout.decode('utf-8')
    out = {'aba': p.stem, 'saldo_anterior': None, 'receitas': [], 'despesas': [], 'grupos': [],
           'total_receitas': None, 'total_despesas': None, 'movimentos': [], 'saldo': None}
    secao = n = None

    def valores(nums, linha):
        v = [round(float(x.replace('.', '').replace(',', '.')), 2) for x in nums]
        if len(v) == 2 * n:  # pares valor/% (grupos, subtotais, totais)
            return v[::2]
        if len(v) == n:
            return v
        if len(v) < n and not any(v):  # célula vazia numa linha toda zerada
            return [0.0] * n
        raise SystemExit(f'{p.name}: {len(v)} valores para {n} meses: {linha}')

    for linha in texto.splitlines():
        cel = [c for c in re.split(r'\s{2,}', linha.strip()) if c]
        if not cel:
            continue
        nums = [c for c in cel if DINHEIRO.match(c)]
        txts = [c for c in cel if not DINHEIRO.match(c) and c != 'R$']
        if cel[0] == 'Unidade:':
            m = re.match(r'(.*?)\s*\((\w+)\)', sem_acento(cel[1]))
            out['unidade'], out['conta'] = m[1].strip(), m[2]
            out['saldo_anterior'] = round(float(nums[-1].replace('.', '').replace(',', '.')), 2)
        elif cel[0] == 'Período:':
            m = re.match(r'(\d\d)/(\d\d) a (\d\d)/(\d\d)/(\d{4})', cel[1])
            out['ano'], out['mes_ini'], out['mes_fim'] = int(m[5]), int(m[2]), int(m[4])
            n = out['mes_fim'] - out['mes_ini'] + 1
            out['meses'] = [f"{out['ano']}-{m:02d}-01" for m in range(out['mes_ini'], out['mes_fim'] + 1)]
        elif cel[0] in ('RECEITAS', 'DESPESAS'):
            secao = cel[0]
        elif secao == 'RECEITAS' and nums:
            if txts == ['TOTAL']:
                out['total_receitas'] = valores(nums, linha)
            elif len(nums) == n:  # linha de detalhe; subtotal (REPASSE, FINANCEIRO) vem em pares
                out['receitas'].append({'nome': txts[0], 'valores': valores(nums, linha)})
        elif secao == 'DESPESAS':
            cod = next((t for t in txts if re.fullmatch(r'\d+\.\d+', t)), None)
            if cod:
                nome = txts[txts.index(cod) + 1] if txts.index(cod) + 1 < len(txts) else ''
                destino = out['grupos'] if cod.endswith('.0') and not cod.startswith('0') else out['despesas']
                destino.append({'codigo': cod, 'nome': nome, 'valores': valores(nums, linha)})
            elif nums and not txts:
                out['total_despesas'] = valores(nums, linha)
                secao = 'MOVIMENTOS'
        elif secao == 'MOVIMENTOS' and txts:
            if sem_acento(txts[0]).startswith('SALDO EM CONTA'):
                out['saldo'] = valores(nums, linha)
                break
            out['movimentos'].append({'descricao': txts[0], 'valores': valores(nums, linha)})
    if n is None or out['saldo'] is None or out['total_despesas'] is None or 'unidade' not in out:
        raise SystemExit(f'{p.name}: estrutura não reconhecida')
    return out


def main(arq):
    p = Path(arq)
    if p.suffix.lower() == '.pdf':
        dados = {'arquivo': p.name, 'abas': [ler_pdf(p)]}
    else:
        wb = openpyxl.load_workbook(p, data_only=True)
        dados = {'arquivo': p.name, 'abas': [ler_aba(ws) for ws in wb.worksheets]}
    destino = p.with_name(p.stem + '.financeiro.json')
    destino.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding='utf-8')
    for a in dados['abas']:
        print(f"{a['aba']}: {len(a['receitas'])} receitas, {len(a['despesas'])} despesas, "
              f"{len(a['movimentos'])} movimentos, meses {a['meses'][0]}..{a['meses'][-1]}")
    print('->', destino)


if __name__ == '__main__':
    for a in sys.argv[1:]:
        main(a)
