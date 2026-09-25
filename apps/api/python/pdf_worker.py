"""Private, stdin/stdout PDF editing worker. Document text is never logged."""

from __future__ import annotations

import base64
import json
import sys
from collections import Counter
from typing import Any

import pymupdf


MAX_PAGES = 80
MAX_BLOCKS = 250
MAX_CHARS = 60_000


class DocumentError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def decode_document(payload: dict[str, Any]) -> pymupdf.Document:
    try:
        raw = base64.b64decode(payload["data"], validate=True)
        document = pymupdf.open(stream=raw, filetype="pdf")
    except Exception as error:
        raise DocumentError("INVALID_PDF", "This PDF could not be opened. It may be damaged or encrypted.") from error
    if document.needs_pass:
        document.close()
        raise DocumentError("ENCRYPTED_PDF", "Password-protected PDFs are not supported yet.")
    if document.page_count > MAX_PAGES:
        document.close()
        raise DocumentError("PDF_PAGE_LIMIT", f"PDFs may contain at most {MAX_PAGES} pages.")
    return document


def describe(document: pymupdf.Document) -> dict[str, Any]:
    blocks: list[dict[str, Any]] = []
    total_characters = 0
    for page_number, page in enumerate(document):
        for block_index, block in enumerate(page.get_text("dict", sort=True)["blocks"]):
            if block.get("type") != 0:
                continue
            lines = block.get("lines", [])
            text_lines = ["".join(span.get("text", "") for span in line.get("spans", [])) for line in lines]
            text = "\n".join(line for line in text_lines if line.strip()).strip()
            if not text:
                continue
            spans = [span for line in lines for span in line.get("spans", []) if span.get("text", "").strip()]
            if not spans:
                continue
            primary = max(spans, key=lambda span: len(span.get("text", "")))
            identifier = len(blocks)
            blocks.append({
                "id": identifier,
                "page": page_number,
                "block": block_index,
                "bbox": [float(value) for value in block["bbox"]],
                "text": text,
                "font": str(primary.get("font", "Helvetica")),
                "size": float(primary.get("size", 11)),
                "color": int(primary.get("color", 0)),
                "flags": int(primary.get("flags", 0)),
            })
            total_characters += len(text)
    if total_characters < 8:
        raise DocumentError("SCANNED_PDF_UNSUPPORTED", "This PDF has no usable text layer. Scanned PDFs need OCR support, which is not included yet.")
    if len(blocks) > MAX_BLOCKS or total_characters > MAX_CHARS:
        raise DocumentError("PDF_CONTENT_LIMIT", f"PDFs are limited to {MAX_BLOCKS} text blocks and {MAX_CHARS:,} characters.")
    return {"pages": document.page_count, "blocks": blocks, "characters": total_characters}


def _font_alias(name: str, flags: int) -> str:
    normalized = name.lower().replace(" ", "")
    bold = bool(flags & 16) or "bold" in normalized or "black" in normalized
    italic = bool(flags & 2) or "italic" in normalized or "oblique" in normalized
    if "courier" in normalized or "mono" in normalized:
        return "cobi" if bold and italic else "cobo" if bold else "coit" if italic else "co"
    if "times" in normalized or "serif" in normalized or "cambria" in normalized or "georgia" in normalized:
        return "tibi" if bold and italic else "tibo" if bold else "tiit" if italic else "tiro"
    return "hebi" if bold and italic else "hebo" if bold else "heit" if italic else "helv"


def _normalized_font(name: str) -> str:
    return name.split("+")[-1].replace(" ", "").lower()


def _font_for_block(document: pymupdf.Document, page: pymupdf.Page, block: dict[str, Any], cache: dict[tuple[int, str], tuple[str, bytes | None, pymupdf.Font]]) -> tuple[str, bytes | None, pymupdf.Font]:
    font_name = block["font"]
    for xref, _extension, _font_type, basefont, _resource, _encoding, *_rest in page.get_fonts(full=True):
        if _normalized_font(font_name) not in _normalized_font(basefont) and _normalized_font(basefont) not in _normalized_font(font_name):
            continue
        key = (xref, font_name)
        if key in cache:
            return cache[key]
        try:
            _basename, _ext, _kind, buffer = document.extract_font(xref)
            font = pymupdf.Font(fontbuffer=buffer)
            if all(char.isspace() or font.has_glyph(ord(char)) for char in block["text"]):
                alias = f"hmd{xref}"
                page.insert_font(fontname=alias, fontbuffer=buffer)
                result = (alias, buffer, font)
                cache[key] = result
                return result
        except Exception:
            pass
    alias = _font_alias(font_name, block["flags"])
    font = pymupdf.Font(fontname=alias)
    cache[(0, alias)] = (alias, None, font)
    return alias, None, font


def _wrap_to_box(text: str, font: pymupdf.Font, max_width: float, font_size: float) -> list[str] | None:
    lines: list[str] = []
    for paragraph in text.splitlines() or [text]:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        line = words[0]
        if font.text_length(line, fontsize=font_size) > max_width:
            return None
        for word in words[1:]:
            candidate = f"{line} {word}"
            if font.text_length(candidate, fontsize=font_size) <= max_width:
                line = candidate
            else:
                lines.append(line)
                line = word
                if font.text_length(line, fontsize=font_size) > max_width:
                    return None
        lines.append(line)
    return lines


def _fit_text(text: str, rect: pymupdf.Rect, font: pymupdf.Font, original_size: float) -> tuple[list[str], float] | None:
    width = max(1, rect.width - 1.5)
    height = max(1, rect.height - 1)
    start = min(max(original_size, 5), 72)
    min_size = max(5, start * 0.68)
    for step in range(13):
        size = start - (start - min_size) * step / 12
        lines = _wrap_to_box(text, font, width, size)
        if lines is not None and size * 1.4 + max(0, len(lines) - 1) * size * 1.12 <= height:
            return lines, size
    return None


def _background(page: pymupdf.Page, rect: pymupdf.Rect) -> tuple[float, float, float] | None:
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(0.5, 0.5), alpha=False, colorspace=pymupdf.csRGB)
    scale = 0.5
    points = [
        (rect.x0 - 2, rect.y0 - 2),
        (rect.x1 + 2, rect.y0 - 2),
        (rect.x0 - 2, rect.y1 + 2),
        (rect.x1 + 2, rect.y1 + 2),
    ]
    pixels: list[tuple[int, int, int]] = []
    for x, y in points:
        px, py = round(x * scale), round(y * scale)
        if 0 <= px < pixmap.width and 0 <= py < pixmap.height:
            pixels.append(tuple(pixmap.pixel(px, py)[:3]))
    if not pixels:
        return 1, 1, 1
    colors = [tuple(channel / 255 for channel in pixel) for pixel in pixels]
    if any(max(abs(a - b) for a, b in zip(colors[0], color, strict=True)) > 0.16 for color in colors[1:]):
        return None
    medians = [sorted(color[channel] for color in colors)[len(colors) // 2] for channel in range(3)]
    return tuple(medians)


def rewrite_pdf(document: pymupdf.Document, request: dict[str, Any]) -> dict[str, Any]:
    edits = {int(edit["id"]): edit["rewritten"] for edit in request.get("edits", [])}
    original = describe(document)
    candidates: list[dict[str, Any]] = []
    skipped: list[str] = []
    font_cache: dict[tuple[int, str], tuple[str, bytes | None, pymupdf.Font]] = {}
    for block in original["blocks"]:
        if block["id"] not in edits:
            continue
        page = document[block["page"]]
        if page.rotation not in (0, 180):
            skipped.append("A rotated page was left untouched to protect its layout.")
            continue
        rect = pymupdf.Rect(block["bbox"]).intersect(page.rect)
        if rect.is_empty or rect.width <= 0 or rect.height <= 0:
            skipped.append("One text area had invalid page coordinates and was left untouched.")
            continue
        overlaps_text = any(
            other["id"] != block["id"]
            and other["page"] == block["page"]
            and pymupdf.Rect(other["bbox"]).intersects(rect)
            for other in original["blocks"]
        )
        if overlaps_text:
            skipped.append("Overlapping PDF text areas were left untouched to protect adjacent content.")
            continue
        if any(link.get("from", pymupdf.Rect()).intersects(rect) for link in page.get_links()):
            skipped.append("Text next to a PDF link was left untouched to keep the link working.")
            continue
        background = _background(page, rect)
        if background is None:
            skipped.append("Text on a non-uniform background was left untouched to protect nearby artwork.")
            continue
        alias, buffer, font = _font_for_block(document, page, block, font_cache)
        fitted = _fit_text(edits[block["id"]], rect, font, block["size"])
        if fitted is None:
            skipped.append("A rewritten paragraph did not fit its original PDF text area, so the original was kept.")
            continue
        lines, size = fitted
        candidates.append({"block": block, "rect": rect, "alias": alias, "buffer": buffer, "font": font, "background": background, "lines": lines, "size": size, "text": edits[block["id"]]})

    per_page: dict[int, list[dict[str, Any]]] = {}
    for candidate in candidates:
        per_page.setdefault(candidate["block"]["page"], []).append(candidate)
    applied: list[dict[str, Any]] = []
    for page_number, page_candidates in per_page.items():
        page = document[page_number]
        for candidate in page_candidates:
            page.add_redact_annot(candidate["rect"], fill=candidate["background"], cross_out=False)
        page.apply_redactions(images=0, graphics=0, text=0)
        for candidate in page_candidates:
            block = candidate["block"]
            result = page.insert_textbox(
                candidate["rect"],
                "\n".join(candidate["lines"]),
                fontname=candidate["alias"],
                fontsize=candidate["size"],
                lineheight=1.12,
                color=tuple(((block["color"] >> shift) & 255) / 255 for shift in (16, 8, 0)),
                align=0,
                overlay=True,
            )
            if result < -0.01:
                raise DocumentError("PDF_LAYOUT_FAILED", "A PDF text box could not be laid out safely. No output was created.")
            applied.append({"id": block["id"], "page": page_number + 1})
    if not applied:
        raise DocumentError("NO_PDF_REWRITES_FIT", "No rewritten text fitted safely in the original PDF layout. Your original file is unchanged.")
    output = document.tobytes(garbage=4, deflate=True)
    return {"data": base64.b64encode(output).decode("ascii"), "applied": applied, "skipped": skipped}


def main() -> None:
    try:
        request = json.load(sys.stdin)
        document = decode_document(request)
        try:
            if request.get("operation") == "describe":
                result = describe(document)
            elif request.get("operation") == "rewrite":
                result = rewrite_pdf(document, request)
            else:
                raise DocumentError("INVALID_OPERATION", "Unsupported PDF operation.")
        finally:
            document.close()
        json.dump({"ok": True, **result}, sys.stdout, separators=(",", ":"))
    except DocumentError as error:
        json.dump({"ok": False, "code": error.code, "error": str(error)}, sys.stdout, separators=(",", ":"))
    except Exception:
        json.dump({"ok": False, "code": "PDF_PROCESSING_FAILED", "error": "The PDF could not be processed safely. Your original file is unchanged."}, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()
