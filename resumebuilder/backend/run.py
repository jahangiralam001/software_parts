from app import create_app
import os

app = create_app()

if __name__ == "__main__":
    # Bind to 0.0.0.0 and honor the PORT environment variable for platform deploys.
    port = int(os.environ.get("PORT", 5000))
    debug_env = os.environ.get("FLASK_DEBUG", "1").lower()
    debug_mode = debug_env in ("1", "true", "yes", "on")
    app.run(host="0.0.0.0", port=port, debug=debug_mode, use_reloader=debug_mode)
