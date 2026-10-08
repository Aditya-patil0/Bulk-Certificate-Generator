import math
from pathlib import Path
from typing import Optional
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from backend.app.config import CERTIFICATES_DIR

# Certificate dimensions for PDF (Landscape A4 in points)
PAGE_WIDTH, PAGE_HEIGHT = landscape(A4)

NAVY = HexColor("#0A192F")
GOLD = HexColor("#C59B27")
LIGHT_GOLD = HexColor("#F5E6AB")
DARK_SLATE = HexColor("#1E293B")
MUTED_SLATE = HexColor("#64748B")
BORDER_BG = HexColor("#FAFAF9")

def draw_ornate_corners(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, size: float = 24):
    c.setStrokeColor(GOLD)
    c.setLineWidth(2)
    # Top-Left
    c.line(x1, y2 - size, x1, y2)
    c.line(x1, y2, x1 + size, y2)
    c.line(x1 + 6, y2 - size + 6, x1 + 6, y2 - 6)
    c.line(x1 + 6, y2 - 6, x1 + size - 6, y2 - 6)

    # Top-Right
    c.line(x2 - size, y2, x2, y2)
    c.line(x2, y2, x2, y2 - size)
    c.line(x2 - size + 6, y2 - 6, x2 - 6, y2 - 6)
    c.line(x2 - 6, y2 - 6, x2 - 6, y2 - size + 6)

    # Bottom-Left
    c.line(x1, y1 + size, x1, y1)
    c.line(x1, y1, x1 + size, y1)
    c.line(x1 + 6, y1 + size - 6, x1 + 6, y1 + 6)
    c.line(x1 + 6, y1 + 6, x1 + size - 6, y1 + 6)

    # Bottom-Right
    c.line(x2 - size, y1, x2, y1)
    c.line(x2, y1, x2, y1 + size)
    c.line(x2 - size + 6, y1 + 6, x2 - 6, y1 + 6)
    c.line(x2 - 6, y1 + 6, x2 - 6, y1 + size - 6)

def draw_vector_seal(c: canvas.Canvas, cx: float, cy: float, radius: float = 34):
    c.saveState()
    # Starburst teeth
    c.setFillColor(GOLD)
    c.setStrokeColor(GOLD)
    num_teeth = 32
    path = c.beginPath()
    for i in range(num_teeth * 2):
        angle = i * (math.pi / num_teeth)
        r = radius if i % 2 == 0 else radius - 4
        px = cx + r * math.cos(angle)
        py = cy + r * math.sin(angle)
        if i == 0:
            path.moveTo(px, py)
        else:
            path.lineTo(px, py)
    path.close()
    c.drawPath(path, fill=1, stroke=0)

    # Inner Gold Circle
    c.setFillColor(NAVY)
    c.setStrokeColor(LIGHT_GOLD)
    c.setLineWidth(1.5)
    c.circle(cx, cy, radius - 8, fill=1, stroke=1)

    # Seal Label
    c.setFillColor(LIGHT_GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(cx, cy + 4, "OFFICIAL")
    c.drawCentredString(cx, cy - 6, "SEAL")
    c.restoreState()

def generate_pdf_certificate(
    recipient_name: str,
    course_name: str,
    issuer_organization: str,
    issue_date: str,
    certificate_code: str,
    instructor_name: Optional[str] = None,
    grade: Optional[str] = None,
    output_pdf_path: Optional[Path] = None
) -> Path:
    if output_pdf_path is None:
        output_pdf_path = CERTIFICATES_DIR / f"{certificate_code}.pdf"
    
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output_pdf_path), pagesize=landscape(A4))

    # Page background
    c.setFillColor(HexColor("#FDFDFD"))
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

    # Outer decorative frame
    margin = 32
    c.setStrokeColor(NAVY)
    c.setLineWidth(5)
    c.rect(margin, margin, PAGE_WIDTH - 2 * margin, PAGE_HEIGHT - 2 * margin, fill=0, stroke=1)

    # Inner Gold Border
    inner_margin = margin + 8
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.5)
    c.rect(inner_margin, inner_margin, PAGE_WIDTH - 2 * inner_margin, PAGE_HEIGHT - 2 * inner_margin, fill=0, stroke=1)

    # Thin hairline inner border
    hairline_margin = inner_margin + 5
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.setLineWidth(0.75)
    c.rect(hairline_margin, hairline_margin, PAGE_WIDTH - 2 * hairline_margin, PAGE_HEIGHT - 2 * hairline_margin, fill=0, stroke=1)

    # Corner decorations
    draw_ornate_corners(c, inner_margin, inner_margin, PAGE_WIDTH - inner_margin, PAGE_HEIGHT - inner_margin)

    center_x = PAGE_WIDTH / 2.0

    # Top Brand / Issuer Organization
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(GOLD)
    c.drawCentredString(center_x, PAGE_HEIGHT - 75, issuer_organization.upper())

    # Header: Certificate of Completion
    c.setFont("Times-Bold", 32)
    c.setFillColor(NAVY)
    c.drawCentredString(center_x, PAGE_HEIGHT - 120, "CERTIFICATE OF ACHIEVEMENT")

    # Sub-header
    c.setFont("Helvetica", 11)
    c.setFillColor(MUTED_SLATE)
    c.drawCentredString(center_x, PAGE_HEIGHT - 150, "THIS IS PROUDLY PRESENTED TO")

    # Recipient Name
    c.setFont("Times-Bold", 30)
    c.setFillColor(NAVY)
    c.drawCentredString(center_x, PAGE_HEIGHT - 200, recipient_name)

    # Decorative Rule under name
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.5)
    rule_width = min(420, max(260, len(recipient_name) * 16))
    c.line(center_x - rule_width / 2, PAGE_HEIGHT - 212, center_x + rule_width / 2, PAGE_HEIGHT - 212)

    # Middle Description
    c.setFont("Helvetica", 11)
    c.setFillColor(DARK_SLATE)
    c.drawCentredString(
        center_x,
        PAGE_HEIGHT - 245,
        "for successfully completing all professional curriculum requirements in"
    )

    # Course Name
    c.setFont("Times-Bold", 20)
    c.setFillColor(NAVY)
    c.drawCentredString(center_x, PAGE_HEIGHT - 280, course_name)

    # Optional Grade / Distinction
    if grade:
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(GOLD)
        c.drawCentredString(center_x, PAGE_HEIGHT - 310, f"Distinction: {grade}")

    # Bottom layout: Date (left), Seal (center), Signature (right)
    bottom_y = 120
    left_x = center_x - 220
    right_x = center_x + 220

    # Date
    c.setFont("Times-Roman", 12)
    c.setFillColor(DARK_SLATE)
    c.drawCentredString(left_x, bottom_y + 16, issue_date)
    c.setStrokeColor(HexColor("#94A3B8"))
    c.setLineWidth(1)
    c.line(left_x - 70, bottom_y + 8, left_x + 70, bottom_y + 8)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(MUTED_SLATE)
    c.drawCentredString(left_x, bottom_y - 6, "DATE OF ISSUANCE")

    # Seal in center
    draw_vector_seal(c, center_x, bottom_y + 15, radius=34)

    # Signature
    signer = instructor_name if instructor_name else "Academic Director"
    c.setFont("Times-Italic", 13)
    c.setFillColor(NAVY)
    c.drawCentredString(right_x, bottom_y + 16, signer)
    c.setStrokeColor(HexColor("#94A3B8"))
    c.setLineWidth(1)
    c.line(right_x - 70, bottom_y + 8, right_x + 70, bottom_y + 8)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(MUTED_SLATE)
    c.drawCentredString(right_x, bottom_y - 6, "AUTHORIZED SIGNATURE")

    # Bottom Verification ID Footer
    footer_y = 52
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED_SLATE)
    c.drawString(inner_margin + 16, footer_y, f"Verification ID: {certificate_code}")
    c.drawRightString(PAGE_WIDTH - inner_margin - 16, footer_y, "Valid Certificate Record")

    c.showPage()
    c.save()
    return output_pdf_path

def generate_preview_image(
    recipient_name: str,
    course_name: str,
    issuer_organization: str,
    issue_date: str,
    certificate_code: str,
    instructor_name: Optional[str] = None,
    grade: Optional[str] = None,
    output_png_path: Optional[Path] = None
) -> Path:
    if output_png_path is None:
        output_png_path = CERTIFICATES_DIR / f"{certificate_code}.png"

    output_png_path.parent.mkdir(parents=True, exist_ok=True)

    # Render a high-res 1200x848 image
    width, height = 1200, 848
    img = Image.new("RGB", (width, height), color=(253, 253, 253))
    draw = ImageDraw.Draw(img)

    # Palette
    c_navy = (10, 25, 47)
    c_gold = (197, 155, 39)
    c_dark = (30, 41, 59)
    c_muted = (100, 116, 139)

    # Outer border
    draw.rectangle([(40, 40), (width - 40, height - 40)], outline=c_navy, width=6)
    # Inner gold border
    draw.rectangle([(52, 52), (width - 52, height - 52)], outline=c_gold, width=2)
    # Hairline border
    draw.rectangle([(60, 60), (width - 60, height - 60)], outline=(226, 232, 240), width=1)

    center_x = width // 2

    # Issuer
    draw.text((center_x, 110), issuer_organization.upper(), fill=c_gold, anchor="mm")
    
    # Header
    draw.text((center_x, 175), "CERTIFICATE OF ACHIEVEMENT", fill=c_navy, anchor="mm")

    # Sub-header
    draw.text((center_x, 225), "THIS IS PROUDLY PRESENTED TO", fill=c_muted, anchor="mm")

    # Recipient
    draw.text((center_x, 305), recipient_name, fill=c_navy, anchor="mm")

    # Gold line
    rule_len = min(600, max(360, len(recipient_name) * 22))
    draw.line(
        [(center_x - rule_len // 2, 335), (center_x + rule_len // 2, 335)],
        fill=c_gold,
        width=2
    )

    # Body
    draw.text((center_x, 390), "for successfully completing all professional curriculum requirements in", fill=c_dark, anchor="mm")

    # Course
    draw.text((center_x, 450), course_name, fill=c_navy, anchor="mm")

    if grade:
        draw.text((center_x, 500), f"Distinction: {grade}", fill=c_gold, anchor="mm")

    # Bottom layout
    bottom_y = 660
    left_x = center_x - 320
    right_x = center_x + 320

    # Date
    draw.text((left_x, bottom_y - 20), issue_date, fill=c_dark, anchor="mm")
    draw.line([(left_x - 110, bottom_y), (left_x + 110, bottom_y)], fill=(148, 163, 184), width=1)
    draw.text((left_x, bottom_y + 20), "DATE OF ISSUANCE", fill=c_muted, anchor="mm")

    # Central seal
    seal_radius = 48
    draw.ellipse(
        [(center_x - seal_radius, bottom_y - 25 - seal_radius),
         (center_x + seal_radius, bottom_y - 25 + seal_radius)],
        fill=c_navy,
        outline=c_gold,
        width=3
    )
    draw.text((center_x, bottom_y - 35), "OFFICIAL", fill=c_gold, anchor="mm")
    draw.text((center_x, bottom_y - 15), "SEAL", fill=c_gold, anchor="mm")

    # Signature
    signer = instructor_name if instructor_name else "Academic Director"
    draw.text((right_x, bottom_y - 20), signer, fill=c_navy, anchor="mm")
    draw.line([(right_x - 110, bottom_y), (right_x + 110, bottom_y)], fill=(148, 163, 184), width=1)
    draw.text((right_x, bottom_y + 20), "AUTHORIZED SIGNATURE", fill=c_muted, anchor="mm")

    # Footer
    draw.text((80, height - 75), f"Verification ID: {certificate_code}", fill=c_muted, anchor="lm")
    draw.text((width - 80, height - 75), "Valid Certificate Record", fill=c_muted, anchor="rm")

    img.save(str(output_png_path), "PNG")
    return output_png_path

def generate_certificate(
    recipient_name: str,
    course_name: str,
    issuer_organization: str,
    issue_date: str,
    certificate_code: str,
    instructor_name: Optional[str] = None,
    grade: Optional[str] = None
) -> tuple[Path, Path, int]:
    pdf_path = generate_pdf_certificate(
        recipient_name=recipient_name,
        course_name=course_name,
        issuer_organization=issuer_organization,
        issue_date=issue_date,
        certificate_code=certificate_code,
        instructor_name=instructor_name,
        grade=grade
    )
    preview_path = generate_preview_image(
        recipient_name=recipient_name,
        course_name=course_name,
        issuer_organization=issuer_organization,
        issue_date=issue_date,
        certificate_code=certificate_code,
        instructor_name=instructor_name,
        grade=grade
    )
    file_size = pdf_path.stat().st_size
    return pdf_path, preview_path, file_size
