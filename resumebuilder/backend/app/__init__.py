from flask import Flask
import os

def create_app():
    # compute absolute paths to the frontend templates and static folders
    base_dir = os.path.abspath(os.path.dirname(__file__))
    template_dir = os.path.abspath(os.path.join(base_dir, '..', '..', 'frontend', 'templates'))
    static_dir = os.path.abspath(os.path.join(base_dir, '..', '..', 'frontend', 'static'))

    app = Flask(
        __name__,
        template_folder=template_dir,
        static_folder=static_dir
    )
    # Disable static file caching so CSS/JS changes are always picked up
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    from .routes import main
    app.register_blueprint(main)

    return app
