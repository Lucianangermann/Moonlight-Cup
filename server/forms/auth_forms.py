"""WTForms used by the auth blueprint."""
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField
from wtforms.validators import DataRequired, Length


class LoginForm(FlaskForm):
    username = StringField(
        "Benutzername",
        validators=[
            DataRequired(message="Benutzername ist erforderlich."),
            Length(max=120),
        ],
    )
    password = PasswordField(
        "Passwort",
        validators=[
            DataRequired(message="Passwort ist erforderlich."),
            Length(min=1, max=200),
        ],
    )
