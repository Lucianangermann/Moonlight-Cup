"""WTForms used by the auth blueprint."""
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField
from wtforms.validators import DataRequired, Email, Length


class LoginForm(FlaskForm):
    email = StringField(
        "E-Mail",
        validators=[
            DataRequired(message="E-Mail ist erforderlich."),
            Email(message="Ungültige E-Mail-Adresse."),
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
