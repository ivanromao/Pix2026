# Gera dist/worker.js: um arquivo único para colar no editor do Cloudflare Workers.
# O worker não contém nenhum dado do time: o conteúdo entra cifrado pela tela "Preparar a sala".
import base64, json, os, re

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(AQUI, 'src')
DIST = os.path.join(AQUI, 'dist')

def ler(nome, modo='r'):
    with open(os.path.join(SRC, nome), modo, **({} if 'b' in modo else {'encoding': 'utf-8'})) as f:
        return f.read()

html = ler('app.html')
css = ler('app.css')
js = ler('app.js')
assert '</script' not in js.lower()
html = html.replace('/*CSS*/', css).replace('/*JS*/', js)
for ch in ('–', '—'):
    assert ch not in html, 'travessão no app'

capa = base64.b64encode(ler('capa.jpg', 'rb')).decode()
worker = ler('worker_template.js')
worker = worker.replace('__HTML__', json.dumps(html, ensure_ascii=False)).replace('__CAPA__', json.dumps(capa))

os.makedirs(DIST, exist_ok=True)
with open(os.path.join(DIST, 'worker.js'), 'w', encoding='utf-8') as f:
    f.write(worker)
with open(os.path.join(DIST, 'wrangler.toml'), 'w', encoding='utf-8') as f:
    f.write('name = "aar-squad-delta"\nmain = "worker.js"\ncompatibility_date = "2025-09-01"\n\n'
            '[[d1_databases]]\nbinding = "DB"\ndatabase_name = "aar"\ndatabase_id = "COLE_AQUI_O_ID_DO_BANCO"\n')
print('dist/worker.js', round(len(worker.encode()) / 1024), 'KB')
