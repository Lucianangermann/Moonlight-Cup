"""Public-facing forms (anmeldung)."""
import re

from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Email, Length, Optional, ValidationError


# "Nachname, Vorname" — same convention as in TeilnehmerScreen.js.
_NAME_RE = re.compile(r"^[\w\s\-\.À-ſ]+,\s*[\w\s\-\.À-ſ]+$", re.UNICODE)


def _validate_name_format(_form, field):
    if not _NAME_RE.match(field.data or ""):
        raise ValidationError('Format: Nachname, Vorname (z.B. "Müller, Max").')


class AnmeldungForm(FlaskForm):
    name = StringField(
        "Name (Nachname, Vorname)",
        validators=[DataRequired(message="Name ist erforderlich."),
                    Length(max=120),
                    _validate_name_format],
    )
    email = StringField(
        "E-Mail",
        validators=[DataRequired(message="E-Mail ist erforderlich."),
                    Email(message="Ungültige E-Mail-Adresse."),
                    Length(max=120)],
    )
    verein = StringField(
        "Verein (optional)",
        validators=[Optional(), Length(max=120)],
    )
