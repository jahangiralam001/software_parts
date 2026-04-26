import json
from flask import Blueprint, render_template, request, redirect, url_for, send_from_directory
from . import storage

main = Blueprint("main", __name__)


@main.route("/", methods=["GET"])
def home():
    return render_template("home.html", resume_json="null")


@main.route("/resumes", methods=["GET"])
def resumes_list():
    items = storage.list_resumes()
    return render_template("list.html", resumes=items)


@main.route("/resume/new", methods=["GET"])
def resume_new():
    return redirect(url_for("main.home"))


@main.route("/resume/<resume_id>/edit", methods=["GET"])
def resume_edit(resume_id):
    r = storage.get_resume(resume_id)
    if not r:
        return "Not found", 404
    return render_template("home.html", resume_json=json.dumps(r))


@main.route("/resume/save", methods=["POST"])
def resume_save():
    data = request.get_json(silent=True)
    if not data:
        return {"error": "No JSON data received"}, 400
    saved = storage.save_resume(data)
    return {"id": saved["id"]}


@main.route("/resume/<resume_id>/delete", methods=["POST"])
def resume_delete(resume_id):
    storage.delete_resume(resume_id)
    return redirect(url_for("main.resumes_list"))


@main.route("/resume/upload-photo", methods=["POST"])
def upload_photo():
    f = request.files.get("photo")
    if not f or not f.filename:
        return {"error": "No file provided"}, 400
    filename = storage.save_photo(f)
    return {"filename": filename}


@main.route("/photos/<filename>")
def serve_photo(filename):
    return send_from_directory(storage.PHOTOS_DIR, filename)


@main.route("/resume/preview", methods=["POST"])
def resume_preview():
    data = request.get_json(silent=True) or {}
    return render_template("resume_preview.html", resume=data)


