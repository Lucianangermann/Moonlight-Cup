"""Public-facing forms (anmeldung)."""
import re

from flask_wtf import FlaskForm
from wtforms import IntegerField, RadioField, SelectField, StringField
from wtforms.validators import (
    DataRequired, Email, Length, NumberRange, Optional, ValidationError,
)

from tournament_logic import LEAGUES


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
                    # check_deliverability does a DNS MX lookup on submit, so
                    # typo domains (gmx.dee) are caught at registration time.
                    Email(message="Ungültige E-Mail-Adresse.",
                          check_deliverability=True),
                    Length(max=120)],
    )
    age = IntegerField(
        "Alter",
        validators=[DataRequired(message="Alter ist erforderlich."),
                    NumberRange(min=6, max=99, message="Alter muss zwischen 6 und 99 liegen.")],
    )
    gender = RadioField(
        "Geschlecht",
        choices=[("M", "Herr"), ("F", "Dame")],
        validators=[DataRequired(message="Bitte Geschlecht auswählen.")],
    )
    verein = StringField(
        "Verein",
        validators=[DataRequired(message="Verein ist erforderlich."),
                    Length(max=120)],
    )
    league = SelectField(
        "Liga",
        choices=LEAGUES,  # [(key, label), ...] — same list the app uses
        validators=[DataRequired(message="Bitte Liga auswählen.")],
    )
    midnight_meal = RadioField(
        "Mitternachtsessen",
        choices=[("ja", "Ja"), ("nein", "Nein")],
        validators=[DataRequired(message="Bitte auswählen.")],
    )
    breakfast = RadioField(
        "Frühstück",
        choices=[("ja", "Ja"), ("nein", "Nein")],
        validators=[DataRequired(message="Bitte auswählen.")],
    )
    breakfast_type = RadioField(
        "Frühstücksart",
        choices=[("vegetarisch", "Vegetarisch"), ("weisswurscht", "Weißwurscht")],
        validators=[Optional()],
    )

    def validate(self, extra_validators=None):
        # Conditional requirement at form level: an inline field validator
        # never runs here because Optional() stops the chain on empty input.
        ok = super().validate(extra_validators)
        if self.breakfast.data == "ja" and not self.breakfast_type.data:
            self.breakfast_type.errors.append("Bitte Vegetarisch oder Weißwurscht auswählen.")
            return False
        return ok
