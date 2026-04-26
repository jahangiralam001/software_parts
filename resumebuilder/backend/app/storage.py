import json
import os
import uuid
from typing import List, Dict, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Vercel functions can only write to /tmp at runtime.
DEFAULT_DATA_DIR = (
    "/tmp/resumebuilder-data"
    if os.getenv("VERCEL")
    else os.path.join(PROJECT_ROOT, "data")
)

DATA_DIR = os.path.abspath(os.getenv("RESUMEBUILDER_DATA_DIR", DEFAULT_DATA_DIR))
RESUMES_FILE = os.path.join(DATA_DIR, "resumes.json")
PHOTOS_DIR = os.path.join(DATA_DIR, "photos")


def _ensure_storage():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    if not os.path.exists(RESUMES_FILE):
        with open(RESUMES_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _read_all() -> List[Dict]:
    _ensure_storage()
    try:
        with open(RESUMES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _write_all(items: List[Dict]):
    _ensure_storage()
    with open(RESUMES_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def list_resumes() -> List[Dict]:
    return _read_all()


def get_resume(resume_id: str) -> Optional[Dict]:
    for r in _read_all():
        if r.get("id") == resume_id:
            return r
    return None


def save_resume(data: Dict) -> Dict:
    items = _read_all()
    resume_id = data.get("id")
    if resume_id:
        for i, r in enumerate(items):
            if r.get("id") == resume_id:
                items[i] = data
                _write_all(items)
                return data
    # create new
    data = dict(data)
    data["id"] = str(uuid.uuid4())
    items.append(data)
    _write_all(items)
    return data


def delete_resume(resume_id: str) -> bool:
    items = _read_all()
    new = [r for r in items if r.get("id") != resume_id]
    if len(new) == len(items):
        return False
    _write_all(new)
    return True


def save_photo(file_storage) -> str:
    """Save an uploaded photo and return the filename."""
    _ensure_storage()
    ext = os.path.splitext(file_storage.filename)[1].lower() or ".jpg"
    filename = str(uuid.uuid4()) + ext
    file_storage.save(os.path.join(PHOTOS_DIR, filename))
    return filename
