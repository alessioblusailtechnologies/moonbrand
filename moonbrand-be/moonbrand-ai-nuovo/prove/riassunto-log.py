# Riassume il log JSON di un job: tool chiamati, risultati, generazioni, esito.
import json, sys
for name in sys.argv[1:]:
    print(f'=== {name}')
    try: lines = open(name, encoding='utf-8', errors='replace').read().splitlines()
    except FileNotFoundError: print('nessun log'); continue
    for l in lines:
        try: m = json.loads(l)
        except Exception: print('TXT', l[:200]); continue
        t = m.get('type')
        if t == 'assistant':
            for b in m['message']['content']:
                if b['type'] == 'tool_use': print('TOOL', b['name'], json.dumps(b['input'], ensure_ascii=False)[:220])
                elif b['type'] == 'text': print('TEXT', b['text'][:200].replace('\n', ' '))
        elif t == 'user':
            c = m['message'].get('content')
            if isinstance(c, list):
                for b in c:
                    if b.get('type') == 'tool_result':
                        txt = b.get('content')
                        if isinstance(txt, list): txt = ' '.join(x.get('text', '') for x in txt if isinstance(x, dict))
                        print('RESULT', 'ERR ' if b.get('is_error') else '', str(txt)[:300].replace('\n', ' '))
        elif t == 'result': print('RESULT-FINAL', m.get('subtype'), 'cost', m.get('total_cost_usd'), 'turns', m.get('num_turns'), str(m.get('structured_output') or m.get('errors'))[:600])
        elif t == 'moonbrand_usage': print('USAGE', m.get('task'), m.get('model'), m.get('outcome'), m.get('costUsd'), int(m.get('durationMs', 0) / 1000), 's', m.get('error', ''))
