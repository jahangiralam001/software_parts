from flask import Blueprint, make_response, render_template, request
import os

main = Blueprint("main", __name__)

@main.route("/", methods=["GET"])
def home():
    return render_template("home.html")

@main.route("/resume", methods=["POST"])
def resume_preview():
    name = request.form.get("name")
    email = request.form.get("email")

    return render_template(
        "resume_preview.html",
        name=name,
        email=email
    )

@main.route("/resume/pdf", methods=["POST"])
def resume_pdf():
    name = request.form.get("name")
    email = request.form.get("email")

    html = render_template(
        "resume_preview.html",
        name=name,
        email=email
    )

    # Allow disabling PDF generation for local testing environments where
    # WeasyPrint's native libraries are not installed. Set ENABLE_PDF=0 to
    # disable and avoid install steps.
    if os.environ.get("ENABLE_PDF", "1").lower() in ("0", "false", "no", "off"):
        return "PDF generation is disabled (ENABLE_PDF=0).", 503

    # import WeasyPrint lazily so the app can still start even if
    # WeasyPrint's system dependencies (GTK/Pango/Cairo) are not installed.
    try:
        from weasyprint import HTML
    except Exception as exc:
        # Return a helpful error to the caller instead of crashing the app
        msg = (
            "WeasyPrint is not available. This usually means native libraries "
            "(Cairo, Pango, GDK-PixBuf, etc.) are missing. See: "
            "https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation. "
            f"Underlying error: {exc}"
        )
        return msg, 500

    pdf = HTML(string=html).write_pdf()

    response = make_response(pdf)
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = "attachment; filename=resume.pdf"

    return response
