#!/usr/bin/env python3

import math
import wave
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "api/audio"

RATE = 22050
DURATION = 24
TAU = 2 * math.pi

TRACKS = [
    ("blue-horizon", 80, [60, 64, 67, 71, 69, 67, 64, 62]),
    ("midnight-groove", 100, [57, 60, 64, 67, 64, 60, 55, 57]),
    ("summer-night", 120, [60, 67, 64, 69, 65, 72, 67, 64]),
    ("morning-light", 90, [62, 66, 69, 74, 71, 69, 66, 64]),
    ("neon-city", 140, [53, 60, 65, 68, 65, 60, 56, 60]),

    ("cosmic-journey", 70, [57, 64, 69, 72, 76, 72, 69, 64]),
    ("deep-pulse", 135, [48, 48, 55, 60, 51, 48, 58, 55]),
    ("golden-sunset", 95, [65, 69, 72, 76, 74, 72, 69, 67]),
    ("electric-dreams", 125, [60, 63, 67, 70, 72, 75, 70, 67]),
]


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def generate(name, bpm, notes):
    beat = 60 / bpm
    step = beat / 2
    frequencies = [frequency(note) for note in notes]

    samples = bytearray()

    for i in range(RATE * DURATION):
        t = i / RATE

        # Melodie.
        index = int(t / step) % len(notes)
        local = t % step
        freq = frequencies[index]

        envelope = min(1, local / 0.015)
        envelope *= max(0, 1 - local / step)

        melody = (
            math.sin(TAU * freq * local)
            + 0.25 * math.sin(TAU * freq * 2 * local)
        ) * envelope * 0.28

        # Basse.
        bass_freq = frequencies[
            (int(t / (beat * 2)) * 2) % len(notes)
        ] / 4

        bass_time = t % beat

        bass = (
            math.sin(TAU * bass_freq * bass_time)
            * math.exp(-3 * bass_time)
            * min(1, bass_time / 0.01)
            * 0.18
        )

        # Percussion.
        kick_time = t % beat

        kick = (
            math.sin(
                TAU * (
                    45 * kick_time
                    + 2 * (1 - math.exp(-25 * kick_time))
                )
            )
            * math.exp(-20 * kick_time)
            * 0.20
        )

        fade = min(
            1,
            t / 0.3,
            (DURATION - t) / 0.5
        )

        sample = (melody + bass + kick) * fade

        value = int(
            max(-1, min(1, sample)) * 32767
        )

        samples.extend(struct.pack("<h", value))

    path = OUTPUT / f"{name}.wav"

    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(samples)

    print(f"OK : {path.name} - {DURATION}s")


OUTPUT.mkdir(parents=True, exist_ok=True)

for track in TRACKS:
    path = OUTPUT / f"{track[0]}.wav"

    if path.exists():
        print(f"Existe deja : {path.name}")
        continue

    generate(*track)
