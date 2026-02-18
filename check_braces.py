import re
with open('standalone.html', 'r', encoding='utf-8') as f:
    content = f.read()

marker = '    <!-- Embedded Data -->'
idx = content.find(marker)
rest = content[idx:]
scripts = re.findall(r'<script[^>]*>([\s\S]*?)</script>', rest)
if len(scripts) >= 2:
    app_js = scripts[1]
    o = app_js.count('{')
    c = app_js.count('}')
    print('Braces: open', o, 'close', c, 'diff', o - c)
    print('Last 400 chars:')
    print(app_js[-400:])
