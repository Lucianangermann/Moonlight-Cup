"""WTForms for the admin area. CSRF is enforced by Flask-WTF on every POST."""
import re

from flask_wtf import FlaskForm
from wtforms import (
    StringField, SelectField, IntegerField, HiddenField, DateTimeLocalField,
)
from wtforms.validators import DataRequired, Email, Length, Optional, NumberRange, ValidationError

from tournament_logic import LEAGUES


_NAME_RE = re.compile(r"^[\w\s\-\.À-ſ]+,\s*[\w\s\-\.À-ſ]+$", re.UNICODE)


def _validate_name_format(_form, field):
    if not _NAME_RE.match(field.data or ""):
        raise ValidationError("Format: Nachname, Vorname.")


_LEAGUE_CHOICES = [(k, f"{k} — {label}") for k, label in LEAGUES]
_GENDER_CHOICES = [("M", "Männlich"), ("F", "Weiblich")]


# --- Teilnehmer-Verwaltung ----------------------------------------------------

class AddParticipantForm(FlaskForm):
    name = StringField("Name (Nachname, Vorname)",
                       validators=[DataRequired(), Length(max=120), _validate_name_format])
    gender = SelectField("Geschlecht", choices=_GENDER_CHOICES, validators=[DataRequired()])
    league = SelectField("Liga", choices=_LEAGUE_CHOICES, validators=[DataRequired()])
    verein = StringField("Verein (optional)", validators=[Optional(), Length(max=120)])
    email = StringField("E-Mail (optional)", validators=[Optional(), Email(), Length(max=120)])


class EditParticipantForm(FlaskForm):
    pid = HiddenField(validators=[DataRequired()])
    name = StringField("Name (Nachname, Vorname)",
                       validators=[DataRequired(), Length(max=120), _validate_name_format])
    gender = SelectField("Geschlecht", choices=_GENDER_CHOICES, validators=[DataRequired()])
    league = SelectField("Liga", choices=_LEAGUE_CHOICES, validators=[DataRequired()])
    verein = StringField("Verein", validators=[Optional(), Length(max=120)])
    email = StringField("E-Mail", validators=[Optional(), Email(), Length(max=120)])


class ConfirmAnmeldungForm(FlaskForm):
    """Promote a pending Anmeldung → Participant. Admin picks gender + league."""
    anmeldung_id = HiddenField(validators=[DataRequired()])
    gender = SelectField("Geschlecht", choices=_GENDER_CHOICES, validators=[DataRequired()])
    league = SelectField("Liga", choices=_LEAGUE_CHOICES, validators=[DataRequired()])


# --- Ergebnis erfassen --------------------------------------------------------

class MatchResultForm(FlaskForm):
    match_id = HiddenField(validators=[DataRequired()])
    score_a = IntegerField("Score A",
                           validators=[DataRequired(message="Score A erforderlich."),
                                       NumberRange(min=0, max=99)])
    score_b = IntegerField("Score B",
                           validators=[DataRequired(message="Score B erforderlich."),
                                       NumberRange(min=0, max=99)])

    def validate_score_a(self, _field):
        if self.score_a.data == self.score_b.data:
            raise ValidationError("Unentschieden ist nicht möglich.")


# --- Stat-Adjustment (Rangliste manuell anpassen) -----------------------------

class StatAdjustmentForm(FlaskForm):
    pid = HiddenField(validators=[DataRequired()])
    games = IntegerField("Spiele Δ", default=0, validators=[NumberRange(min=-999, max=999)])
    wins = IntegerField("Siege Δ", default=0, validators=[NumberRange(min=-999, max=999)])
    diff = IntegerField("Differenz Δ", default=0, validators=[NumberRange(min=-9999, max=9999)])

    def validate_wins(self, _field):
        # Original RanglisteScreen rule: wins ≤ games (after adjustment).
        # We can't fully verify here without reading the live count; just do a
        # rough sanity check on the adjustment itself.
        if self.wins.data > 0 and self.games.data is not None and self.games.data < self.wins.data:
            raise ValidationError("Siege dürfen Spiele nicht überschreiten.")


# --- Timer --------------------------------------------------------------------

class TimerForm(FlaskForm):
    label = StringField("Label",
                        validators=[DataRequired(), Length(max=80)],
                        render_kw={"placeholder": 'z.B. Runde 3 startet'})
    target_time = DateTimeLocalField(
        "Zielzeit",
        validators=[DataRequired(message="Zielzeit erforderlich.")],
        format="%Y-%m-%dT%H:%M",
    )
