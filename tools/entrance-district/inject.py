"""Put stage1/entrance-district.js into the single-file index.html (right after the entrance gate), idempotently."""
import os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
html_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', '..', 'public', 'index.html')
src = open(os.path.join(here, 'entrance-district.js'), encoding='utf-8').read()
assert '</script' not in src
h = open(html_path, encoding='utf-8').read()
tag = '<script data-src="stage1/entrance-district.js">'
if tag in h:
    a = h.index(tag) + len(tag); b = h.index('</script>', a); h = h[:a] + src + h[b:]
else:
    m = re.search(r'<script[^>]*data-src="stage1/entrance-gate.js"[^>]*>', h); e = h.index('</script>', m.end()) + len('</script>')
    h = h[:e] + '\n    ' + tag + src + '</script>' + h[e:]
open(html_path, 'w', encoding='utf-8').write(h); print('ok', len(h))
