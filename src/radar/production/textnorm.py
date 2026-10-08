"""Korean text normalization for TTS.

TTS engines misread digits, units and acronyms in Korean ("100kg", "10시 10분", "FBI").
Scripts keep digits for on-screen captions; the spoken text is normalized here so every
backend reads it the same way. Sino-Korean numbers by default, native numbers before
native counters (세 명, 두 시간).
"""
from __future__ import annotations

import re

SINO = "영일이삼사오육칠팔구"
SMALL_UNITS = ("", "십", "백", "천")
BIG_UNITS = ("", "만", "억", "조", "경")
NATIVE_UNITS = ("", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉")
NATIVE_TENS = ("", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔")
NATIVE_COUNTERS = ("시간", "명", "개", "살", "가지", "마리", "달", "군데", "시")

ACRONYMS = {
    "FBI": "에프비아이", "AI": "에이아이", "SNS": "에스엔에스", "CFO": "씨에프오", "CEO": "씨이오",
    "OTP": "오티피", "URL": "유알엘", "PDF": "피디에프", "IC3": "아이씨쓰리", "PC": "피씨", "SMS": "에스엠에스",
    "ATM": "에이티엠", "USB": "유에스비", "QR": "큐알", "ARS": "에이알에스", "KISA": "키사", "VPN": "브이피엔",
    "IT": "아이티", "TV": "티비", "PIN": "핀", "ID": "아이디", "OS": "오에스", "APP": "앱",
}
_ACRONYM_RE = re.compile(
    r"(?<![A-Za-z0-9])(" + "|".join(sorted(map(re.escape, ACRONYMS), key=len, reverse=True)) + r")(?![A-Za-z0-9])")
_NUMBER_RE = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?")


def _four_digits(n: int) -> str:
    out = ""
    for power in (3, 2, 1, 0):
        d = n // 10 ** power % 10
        if d:
            out += ("" if d == 1 and power else SINO[d]) + SMALL_UNITS[power]
    return out


def sino(n: int) -> str:
    """Sino-Korean reading: 2024 -> 이천이십사, 10000 -> 만, 100000000 -> 일억."""
    if n == 0:
        return "영"
    parts, k = [], 0
    while n:
        group = n % 10000
        if group:
            word = "" if (group == 1 and k == 1) else _four_digits(group)
            parts.append(word + BIG_UNITS[k])
        n //= 10000
        k += 1
    return "".join(reversed(parts))


def native(n: int) -> str:
    """Native Korean counting form for 1..99 (used before counters): 3 -> 세, 20 -> 스무."""
    if not 1 <= n <= 99:
        return sino(n)
    if n == 20:
        return "스무"
    return NATIVE_TENS[n // 10] + NATIVE_UNITS[n % 10]


def _number(match: re.Match) -> str:
    raw = match.group(0).replace(",", "")
    whole, _, frac = raw.partition(".")
    n = int(whole)
    after = match.string[match.end():].lstrip(" ")
    if not frac and 1 <= n <= 99 and after.startswith(NATIVE_COUNTERS):
        return native(n)
    out = sino(n)
    if frac:
        out += "점" + "".join(SINO[int(d)] for d in frac)
    return out


def normalize_for_tts(text: str) -> str:
    """Spoken form of a caption line: acronyms spelled in Hangul, numbers read out, % -> 퍼센트."""
    text = _ACRONYM_RE.sub(lambda m: ACRONYMS[m.group(1)], text)
    text = _NUMBER_RE.sub(_number, text)
    return text.replace("%", "퍼센트")


def tts_problems(text: str) -> list[str]:
    """Tokens a Korean TTS voice is likely to misread after normalization (digits, Latin words)."""
    return sorted(set(re.findall(r"[A-Za-z]{2,}|\d+", text)))


_SENTENCE_END = re.compile(r"(?<=[.?!…])\s+")


def split_sentences(text: str) -> list[str]:
    """Split on sentence-ending punctuation followed by whitespace; keeps the punctuation."""
    return [s for s in (p.strip() for p in _SENTENCE_END.split(text.strip())) if s]


def speakable_length(text: str) -> int:
    """Characters that take speaking time (letters/digits), used to estimate duration and caption timing."""
    return len(re.sub(r"[^\w]", "", text))
