"""Draws the favicon: the oarfish closing its circle, in its own colours, faceted like the game.
   python3 tools/favicon.py            writes favicon.svg
   node tools/shot_favicon.mjs         renders favicon.ico and apple-touch-icon.png from it"""
import math

BODY, BODY_TOP, FACE, JAW = '#c9a877', '#a8875a', '#98a1b2', '#7d8799'
FIN = ['#f4a4b9', '#d83c5f']          # the fin's two reds, turn and turn about
WATER, EYE, PUPIL = '#0b3345', '#f2d24b', '#06222e'
CX, CY = 32, 35.2                      # the middle of the ring, a little low in its 64 by 64 square to leave the crest room

def pt(angle, radius):                 # angle in degrees, clockwise from the top
    a = math.radians(angle)
    return (CX + math.sin(a) * radius, CY - math.cos(a) * radius)

def poly(points, fill):
    return '<polygon points="%s" fill="%s"/>' % (' '.join('%.2f,%.2f' % p for p in points), fill)

parts = ['<rect width="64" height="64" rx="14" fill="%s"/>' % WATER]

# the body: a ring of flat pieces from behind the head round to the tail, thinning as it goes; the fin runs along its outside
N, A0, A1, R = 9, 30, 316, 18.6        # pieces, where the body starts and ends, the ring's radius
def half(t): return 5.9 * (1 - t) ** 0.8 + 1.0          # half the body's thickness
def fin(t): return 3.9 * (1 - t) ** 0.6 + 0.7           # the fin's height
for i in range(N):
    t0, t1 = i / N, (i + 1) / N
    a0, a1 = A0 + (A1 - A0) * t0, A0 + (A1 - A0) * t1
    parts.append(poly([pt(a0, R + half(t0) + fin(t0)), pt(a1, R + half(t1) + fin(t1)), pt(a1, R + half(t1) - 0.2), pt(a0, R + half(t0) - 0.2)], FIN[i % 2]))
    parts.append(poly([pt(a0, R + half(t0)), pt(a1, R + half(t1)), pt(a1, R - half(t1)), pt(a0, R - half(t0))], BODY if i % 2 else BODY_TOP))

# the head: blunt, grey, with its yellow eye, and the crest standing off it
h0, h1 = A0, -14
parts.append(poly([pt(h0, R + half(0)), pt(8, R + 6.6), pt(h1 + 6, R + 5.6), pt(h1, R + 0.5), pt(h1 + 4, R - 5.4), pt(12, R - 6.4), pt(h0, R - half(0))], FACE))
parts.append(poly([pt(h1 + 1, R - 0.8), pt(h1 + 4, R - 5.4), pt(12, R - 6.4), pt(9, R - 2.8)], JAW))
for k, (a, ln) in enumerate([(22, 7.2), (13, 8.6), (4, 8.2), (-5, 6.6)]):       # the crest: four rays, leaning back
    base, tip = pt(a, R + 5.9), pt(a + 10, R + 5.9 + ln)
    w = 1.5
    parts.append(poly([(base[0] - w, base[1]), (base[0] + w, base[1]), tip], FIN[1] if k % 2 else '#ec7090'))
ex, ey = pt(3, R + 1.4)
parts.append('<circle cx="%.2f" cy="%.2f" r="2.9" fill="%s"/><circle cx="%.2f" cy="%.2f" r="1.3" fill="%s"/>' % (ex, ey, EYE, ex - 0.2, ey, PUPIL))

svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + ''.join(parts) + '</svg>\n'
open('favicon.svg', 'w', encoding='utf-8').write(svg)
print('favicon.svg', len(svg), 'bytes')
