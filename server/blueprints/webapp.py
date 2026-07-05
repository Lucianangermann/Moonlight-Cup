"""
Serves the Expo web export of the React/Expo tournament-management app
(the "actual program" per PRODUCT.md) at the site root.

This is a plain single-page app (React Navigation tabs, no expo-router),
so any path not matched by a more specific route falls back to index.html
for client-side routing. Werkzeug picks the most specific matching rule
for a given URL, so exact routes like /anmeldung or /static/<file> always
win over the <path:path> catch-all below *when a rule actually matches the
full URL* — but an unmatched sub-path under /api/ (a typo, or a method that
just isn't implemented) has no other rule to lose to, so it would otherwise
silently fall through to this catch-all and get a 200 HTML page instead of
a 404. We guard that explicitly below so JSON API clients get a real 404.

The build output lives in WEBAPP_DIR (gitignored, populated by the deploy
runbook in server/README.md) — not server/static/, to avoid colliding with
the anmeldung page's own CSS/JS under that folder.
"""
from flask import Blueprint, abort, current_app, send_from_directory

bp = Blueprint("webapp", __name__)


def _serve_index():
    webapp_dir = current_app.config["WEBAPP_DIR"]
    if not (webapp_dir / "index.html").exists():
        return (
            "Web app not deployed yet — see server/README.md's deploy runbook.",
            503,
            {"Content-Type": "text/plain; charset=utf-8"},
        )
    return send_from_directory(webapp_dir, "index.html")


@bp.route("/")
def index():
    return _serve_index()


@bp.route("/<path:path>")
def assets(path):
    # No registered /api/... rule matched this path (else we wouldn't be
    # here) — it's a bad/unimplemented API call, not an SPA route. Fail
    # loudly with JSON, not a 200 HTML page a fetch client would mis-parse.
    if path == "api" or path.startswith("api/"):
        abort(404)

    webapp_dir = current_app.config["WEBAPP_DIR"]
    if (webapp_dir / path).is_file():
        resp = send_from_directory(webapp_dir, path)
        # Expo puts a content hash in every bundle/asset filename, so these
        # are immutable: a new deploy references new URLs. Long cache lets
        # returning phones (and the Cloudflare edge) skip ~9 MB of
        # re-validation round-trips through the tunnel. index.html itself
        # never lands here (served by _serve_index) and stays revalidated.
        if path.startswith(("_expo/", "assets/")):
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return resp
    return _serve_index()
