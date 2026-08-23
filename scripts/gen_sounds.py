"""Generate arcade-style sound effects (WAV) for Super Strike."""
import numpy as np
import wave
import os
import struct

SR = 22050
OUT = "/app/frontend/assets/sounds"
os.makedirs(OUT, exist_ok=True)


def save(name, samples):
    samples = np.clip(samples, -1.0, 1.0)
    # gentle fade in/out to avoid clicks
    n = len(samples)
    fade = min(200, n // 10)
    if fade > 0:
        env = np.ones(n)
        env[:fade] = np.linspace(0, 1, fade)
        env[-fade:] = np.linspace(1, 0, fade)
        samples = samples * env
    pcm = (samples * 32767).astype(np.int16)
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", path, len(pcm), "samples")


def tone(freq, dur, kind="sine", vol=0.5):
    t = np.linspace(0, dur, int(SR * dur), False)
    if kind == "sine":
        s = np.sin(2 * np.pi * freq * t)
    elif kind == "square":
        s = np.sign(np.sin(2 * np.pi * freq * t))
    elif kind == "saw":
        s = 2 * (t * freq - np.floor(0.5 + t * freq))
    elif kind == "tri":
        s = 2 * np.abs(2 * (t * freq - np.floor(0.5 + t * freq))) - 1
    return s * vol


def sweep(f0, f1, dur, kind="square", vol=0.5):
    t = np.linspace(0, dur, int(SR * dur), False)
    freq = np.linspace(f0, f1, len(t))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    if kind == "square":
        s = np.sign(np.sin(phase))
    elif kind == "saw":
        s = 2 * (phase / (2 * np.pi) - np.floor(0.5 + phase / (2 * np.pi)))
    else:
        s = np.sin(phase)
    return s * vol


def noise(dur, vol=0.5):
    return (np.random.rand(int(SR * dur)) * 2 - 1) * vol


def decay(samples, rate=6.0):
    n = len(samples)
    t = np.linspace(0, 1, n)
    return samples * np.exp(-rate * t)


# --- UI tap: soft short blip ---
save("tap.wav", decay(tone(660, 0.08, "sine", 0.4), 12))

# --- lock: crisp double blip (aim/power lock) ---
lock = np.concatenate([decay(tone(880, 0.05, "square", 0.35), 14)])
save("lock.wav", lock)

# --- ball roll: low filtered rumble ~1.1s ---
roll_len = int(SR * 1.1)
rnd = np.random.randn(roll_len)
# simple low-pass (moving average) for rumble
k = 60
kernel = np.ones(k) / k
rumble = np.convolve(rnd, kernel, mode="same")
rumble = rumble / (np.max(np.abs(rumble)) + 1e-9)
wobble = 1 + 0.25 * np.sin(2 * np.pi * 8 * np.linspace(0, 1.1, roll_len))
roll = rumble * wobble * 0.5
# swell then hold
env = np.concatenate([np.linspace(0.3, 1, roll_len // 3), np.ones(roll_len - roll_len // 3)])
save("ball_roll.wav", roll * env)

# --- pin crash: burst of noise + clatter ---
crash_len = int(SR * 0.55)
n1 = noise(0.55, 0.7)
n1 = decay(n1, 5.5)
# add a few resonant clacks
clacks = np.zeros(crash_len)
for f, off in [(420, 0.0), (300, 0.05), (520, 0.1), (240, 0.16), (600, 0.22)]:
    start = int(off * SR)
    seg = decay(tone(f, 0.12, "tri", 0.4), 18)
    end = min(crash_len, start + len(seg))
    clacks[start:end] += seg[: end - start]
save("pin_crash.wav", n1 + clacks)

# --- strike: triumphant ascending arpeggio + shine ---
notes = [523, 659, 784, 1047, 1319]  # C E G C E
strike = np.array([])
for i, f in enumerate(notes):
    seg = decay(tone(f, 0.12, "square", 0.32), 5) + decay(tone(f * 2, 0.12, "sine", 0.12), 6)
    strike = np.concatenate([strike, seg])
# sparkle tail
sparkle = decay(tone(1568, 0.5, "sine", 0.25), 4) + decay(tone(2093, 0.5, "sine", 0.15), 5)
strike = np.concatenate([strike, sparkle])
save("strike.wav", strike)

# --- spare: two-note happy chime ---
spare = np.concatenate([
    decay(tone(659, 0.18, "sine", 0.4), 5) + decay(tone(1319, 0.18, "sine", 0.12), 6),
    decay(tone(988, 0.35, "sine", 0.4), 4) + decay(tone(1976, 0.35, "sine", 0.12), 5),
])
save("spare.wav", spare)

# --- gutter: descending sad trombone ---
save("gutter.wav", decay(sweep(300, 120, 0.6, "saw", 0.4), 2.5))

# --- powerup activation: rising energetic zap ---
zap = sweep(300, 1400, 0.3, "square", 0.35) + sweep(305, 1420, 0.3, "saw", 0.15)
zap = decay(zap, 2.0)
# add shimmer
shimmer = decay(tone(1800, 0.2, "sine", 0.2), 6)
zap = np.concatenate([zap, shimmer])
save("powerup.wav", zap)

# --- win fanfare ---
win_notes = [523, 659, 784, 1047, 784, 1047, 1319]
win = np.array([])
for f in win_notes:
    seg = decay(tone(f, 0.16, "square", 0.3), 4) + decay(tone(f * 1.5, 0.16, "sine", 0.1), 5)
    win = np.concatenate([win, seg])
save("win.wav", win)

print("done")
