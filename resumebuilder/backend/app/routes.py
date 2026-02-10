from flask import Blueprint, make_response, render_template, request, redirect, url_for
import os
from . import storage

main = Blueprint("main", __name__)


@main.route("/", methods=["GET"])
def home():
    # Show the editor for creating a new resume
    return render_template("home.html")


@main.route("/resumes", methods=["GET"])
def resumes_list():
    items = storage.list_resumes()
    return render_template("list.html", resumes=items)


@main.route("/resume/new", methods=["GET"])
def resume_new():
    return render_template("home.html")


@main.route("/resume/<resume_id>/edit", methods=["GET"])
def resume_edit(resume_id):
    r = storage.get_resume(resume_id)
    if not r:
        return "Not found", 404
    return render_template(
        "home.html",
        id=r.get("id"),
        name=r.get("name"),
        email=r.get("email"),
        summary=r.get("summary"),
        edu_title=r.get("edu_title"),
        edu_period=r.get("edu_period"),
        edu_desc=r.get("edu_desc"),
        exp_title=r.get("exp_title"),
        exp_period=r.get("exp_period"),
        exp_desc=r.get("exp_desc"),
        skills=r.get("skills"),
        location=r.get("location"),
        website=r.get("website"),
        soft_skills=r.get("soft_skills"),
    )


@main.route("/resume/save", methods=["POST"])
def resume_save():
    data = {
        "id": request.form.get("id") or None,
        "name": request.form.get("name", ""),
        "email": request.form.get("email", ""),
        "summary": request.form.get("summary", ""),
        "edu_title": request.form.get("edu_title", ""),
        "edu_period": request.form.get("edu_period", ""),
        "edu_desc": request.form.get("edu_desc", ""),
        "exp_title": request.form.get("exp_title", ""),
        "exp_period": request.form.get("exp_period", ""),
        "exp_desc": request.form.get("exp_desc", ""),
        "skills": request.form.get("skills", ""),
        "location": request.form.get("location", ""),
        "website": request.form.get("website", ""),
        "soft_skills": request.form.get("soft_skills", ""),
    }
    saved = storage.save_resume(data)
    return redirect(url_for("main.resumes_list"))


@main.route("/resume/<resume_id>/delete", methods=["POST"])
def resume_delete(resume_id):
    storage.delete_resume(resume_id)
    return redirect(url_for("main.resumes_list"))


@main.route("/resume/preview", methods=["POST"])
def resume_preview():
    fields = {}
    for key in ("name","email","summary","edu_title","edu_period","edu_desc","exp_title","exp_period","exp_desc","skills","location","website","soft_skills"):
        fields[key] = request.form.get(key)

    return render_template("resume_preview.html", **fields)


@main.route("/resume/pdf", methods=["POST"])
def resume_pdf():
    fields = {}
    for key in ("name","email","summary","edu_title","edu_period","edu_desc","exp_title","exp_period","exp_desc","skills","location","website","soft_skills"):
        fields[key] = request.form.get(key)

    html = render_template("resume_preview.html", **fields)

    # Allow disabling PDF generation for local testing environments where
    # WeasyPrint's native libraries are not installed. Set ENABLE_PDF=0 to
    # disable and avoid install steps.
    if os.environ.get("ENABLE_PDF", "1").lower() in ("0", "false", "no", "off"):
        return "PDF generation is disabled (ENABLE_PDF=0).", 503

    try:
        from weasyprint import HTML
    except Exception as exc:
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
