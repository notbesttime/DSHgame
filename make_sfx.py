#!/usr/bin/env python3
# 程序化合成 4 个操作音效(零外部素材依赖):点击/购买/挥鞭/消除。
# 输出 16bit 44.1kHz 单声道 WAV 到 assets/audio/;本机有 ffmpeg 时转 AAC 64k .m4a 并删 WAV。
# 改音色直接改下面的参数重跑即可。纯标准库,无 numpy 依赖。
import math, os, random, shutil, struct, subprocess, wave

random.seed(20261013)
SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'audio')

def write_wav(name, samples):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with wave.open(path, 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', max(-32767, min(32767, int(s * 32767)))) for s in samples))
    print(f"  {name}: {len(samples)/SR*1000:.0f} ms")
    return path

def tone(dur, f0, f1=None, amp=0.5, decay=None, attack=0.004):
    """正弦(可滑音),相位累加避免爆音;decay=指数衰减系数(1/s);attack=淡入秒数。"""
    n = int(SR * dur)
    f1 = f0 if f1 is None else f1
    ph, out = 0.0, []
    for i in range(n):
        t = i / SR
        f = f0 + (f1 - f0) * (i / n)
        ph += 2 * math.pi * f / SR
        g = amp * math.sin(ph)
        if decay: g *= math.exp(-decay * t)
        if attack > 0: g *= min(1.0, t / attack)
        out.append(g)
    return out

def noise(dur, amp=0.5, decay=None, lowpass=1.0):
    """白噪声,可选一阶低通(lowpass>1 越大越闷)与指数衰减。"""
    n = int(SR * dur)
    out, acc = [], 0.0
    for i in range(n):
        t = i / SR
        g = amp * (random.random() * 2 - 1)
        if lowpass > 1:
            acc += (g - acc) / lowpass
            g = acc
        if decay: g *= math.exp(-decay * t)
        out.append(g)
    return out

def mix(*parts):
    n = max(len(p) for p in parts)
    return [sum(p[i] if i < len(p) else 0.0 for p in parts) for i in range(n)]

def concat(*parts):
    out = []
    for p in parts: out += p
    return out

def clip(xs, lim=0.92):
    m = max(1e-9, max(abs(x) for x in xs))
    k = lim / m
    return [x * k for x in xs]

# 1) 点击:45ms 高频快滑落"嗒"(1900→1350Hz,极快衰减)
click = tone(0.045, 1900, 1350, amp=0.5, decay=60, attack=0.001)
# 2) 购买:C5→G5 双音上行"叮咚"(确认感)
buy = concat(tone(0.09, 523.25, amp=0.42, decay=14, attack=0.006),
             tone(0.16, 784.0, amp=0.46, decay=11, attack=0.006))
# 3) 挥鞭:噪声爆裂(低通收高频)+ 165→95Hz 低频 thump
whip = mix(noise(0.13, amp=0.65, decay=34, lowpass=2.2),
           tone(0.10, 165, 95, amp=0.5, decay=26, attack=0.001))
# 4) 消除:75ms 上滑泡泡"啵"(380→950Hz)
pop = tone(0.075, 380, 950, amp=0.52, decay=24, attack=0.002)

made = []
for name, xs in (('sfx_click.wav', click), ('sfx_buy.wav', buy),
                 ('sfx_whip.wav', whip), ('sfx_pop.wav', pop)):
    made.append(write_wav(name, clip(xs)))

ff = shutil.which('ffmpeg') or os.environ.get('FFMPEG')
final = []
for wav in made:
    if ff:
        m4a = wav[:-4] + '.m4a'
        r = subprocess.run([ff, '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '64k', m4a])
        if r.returncode == 0 and os.path.exists(m4a):
            os.remove(wav); final.append(m4a); continue
    final.append(wav)
print("\n最终产物(ff=" + (ff or "无,保留WAV") + "):")
for p in final:
    print(" ", os.path.basename(p), f"({os.path.getsize(p)} B)")
