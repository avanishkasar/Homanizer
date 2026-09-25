"""Regression tests for safe in-place PDF replacement."""

from __future__ import annotations

import base64
import unittest

import pymupdf

from pdf_worker import DocumentError, describe, rewrite_pdf


class PdfRewriteTests(unittest.TestCase):
    def make_document(self, text: str = "A sentence that can be improved.") -> pymupdf.Document:
        document = pymupdf.open()
        page = document.new_page(width=612, height=792)
        page.insert_text((72, 100), "A document heading", fontsize=20)
        page.insert_textbox(pymupdf.Rect(72, 140, 400, 190), text, fontsize=12)
        return document

    def test_replaces_text_and_keeps_page_geometry_and_other_text(self) -> None:
        document = self.make_document()
        before = document[0].rect
        blocks = describe(document)["blocks"]
        target = next(block for block in blocks if "sentence" in block["text"])
        output = rewrite_pdf(document, {"edits": [{"id": target["id"], "rewritten": "A clearer sentence."}]})
        rewritten = pymupdf.open(stream=base64.b64decode(output["data"]), filetype="pdf")
        self.assertEqual(rewritten[0].rect, before)
        text = rewritten[0].get_text()
        self.assertIn("A document heading", text)
        self.assertIn("A clearer sentence.", text)
        self.assertNotIn("A sentence that can be improved.", text)
        self.assertEqual(len(output["applied"]), 1)
        rewritten.close()
        document.close()

    def test_refuses_rewrite_that_cannot_fit_original_text_area(self) -> None:
        document = self.make_document("A short sentence.")
        target = describe(document)["blocks"][1]
        with self.assertRaisesRegex(DocumentError, "No rewritten text fitted"):
            rewrite_pdf(document, {"edits": [{"id": target["id"], "rewritten": " ".join(["unreasonably-long"] * 80)}]})
        document.close()

    def test_refuses_scanned_or_image_only_pdf(self) -> None:
        document = pymupdf.open()
        document.new_page()
        with self.assertRaisesRegex(DocumentError, "no usable text layer"):
            describe(document)
        document.close()


if __name__ == "__main__":
    unittest.main()
