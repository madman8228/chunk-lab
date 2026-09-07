import re
with open('freq-idioms.js', 'r', encoding='utf-8') as f: src = f.read()

# 收集 unique sentences 出现首次位置
seen = {}
for m in re.finditer(r'sentence:\s*"([^"]+)"', src):
    s = m.group(1)
    if s not in seen:
        seen[s] = m.start()
print('unique items:', len(seen))

def find_block(s, target_offset):
    # 往前找最近的 outer `{`
    i = target_offset
    depth = 0
    start = None
    while i > 0:
        i -= 1
        c = s[i]
        if c == '}':
            depth += 1
        elif c == '{':
            if depth == 0:
                start = i
                break
            depth -= 1
    if start is None:
        return None
    # 跟踪 brace 平衡往前找 matching } at depth 0
    depth = 1
    in_str = None
    esc = False
    j = start + 1
    while j < len(s):
        c = s[j]
        if esc:
            esc = False
            j += 1
            continue
        if in_str:
            if c == '\\':
                esc = True
            elif c == in_str:
                in_str = None
        else:
            if c == '"' or c == "'":
                in_str = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return s[start:j+1]
        j += 1
    return None

items = []
fail = []
for s in sorted(seen.keys(), key=lambda x: seen[x]):
    b = find_block(src, seen[s])
    if b is None:
        fail.append(s[:30])
        continue
    if all(k in b for k in ['cid:', 'translation:', 'chunks:', 'hints:', 'grammar:', 'explanations:']):
        items.append(b)
    else:
        miss = [k for k in ['cid:', 'translation:', 'chunks:', 'hints:', 'grammar:', 'explanations:'] if k not in b]
        fail.append((s[:30], miss))
print('items kept:', len(items), 'failures:', len(fail))
for x in fail[:5]:
    print(' FAIL:', x)

# 组装新文件
hdr_marker = 'window.DATA_FREQ_IDIOMS = ['
hdr_end = src.find(hdr_marker)
body_start = hdr_end + len(hdr_marker)
body_end = src.find('];', body_start)
hdr = src[:body_start]
tail = src[body_end+2:]  # skip '];'

items_text = ',\n\n'.join(items)
new_src = hdr + items_text + '\n' + tail
with open('freq-idioms.js', 'w', encoding='utf-8') as f: f.write(new_src)
print('written size:', len(new_src))
