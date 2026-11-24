"""Turns heldout-markup.txt into heldout-set.jsonl in the same format as experiments/pii/pii-set.jsonl.

    python -I -X utf8 pii/heldout/make_heldout.py

{TYPE|value} becomes the plain text with a span; the offsets are computed, never typed.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
MARK = re.compile(r"\{([A-Z_]+)\|([^}]+)\}")


def convert(line: str) -> dict:
    text, spans, cursor = "", [], 0
    for m in MARK.finditer(line):
        text += line[cursor:m.start()]
        spans.append({"start": len(text), "end": len(text) + len(m.group(2)), "type": m.group(1)})
        text += m.group(2)
        cursor = m.end()
    return {"text": text + line[cursor:], "spans": spans}


rows = [convert(l) for l in (HERE / "heldout-markup.txt").read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
(HERE / "heldout-set.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8", newline="\n")
print(len(rows), "lines,", sum(len(r["spans"]) for r in rows), "spans,", sum(not r["spans"] for r in rows), "with no PII")
