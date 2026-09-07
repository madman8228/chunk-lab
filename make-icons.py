#!/usr/bin/env python3
"""生成 Chunk Lab PWA 图标（512 + 192 PNG）：品牌蓝圆角底 + 白色 CL + 三行意群条"""
from PIL import Image, ImageDraw, ImageFont

BRAND = (44, 98, 201, 255)      # --accent #2c62c9
WHITE = (255, 253, 250, 255)    # --surface #fffdfa

def font(size):
    for p in ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/segoeuib.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

def gen(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = size * 0.22
    d.rounded_rectangle([0, 0, size, size], radius=r, fill=BRAND)
    # 白色 "CL"
    f = font(int(size * 0.42))
    text = "CL"
    try:
        bbox = d.textbbox((0, 0), text, font=f)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text(((size - tw) / 2 - bbox[0], size * 0.10 - bbox[1]), text, font=f, fill=WHITE)
    except Exception:
        pass
    # 三行意群条（代表句子 chunks），宽度递减
    bar_h = size * 0.055
    gap = size * 0.065
    x0 = size * 0.26
    widths = [0.48, 0.40, 0.31]
    y = size * 0.60
    for w in widths:
        d.rounded_rectangle([x0, y, x0 + size * w, y + bar_h], radius=bar_h / 2, fill=WHITE)
        y += bar_h + gap
    img.save(path, "PNG")

gen(512, "icon-512.png")
gen(192, "icon-192.png")
gen(180, "icon-180.png")  # iOS apple-touch-icon 规范尺寸
print("icons generated")
