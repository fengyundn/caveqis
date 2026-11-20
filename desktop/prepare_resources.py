"""Create the Windows icon and collect licenses for bundled components."""

from importlib.metadata import distribution
from pathlib import Path
import shutil
import sys

from PIL import Image


DESKTOP = Path(__file__).resolve().parent
BUILD = DESKTOP / ".build"
NOTICES = BUILD / "licenses"
NOTICES.mkdir(parents=True, exist_ok=True)

icon = Image.open(DESKTOP.parent / "static" / "caveqis.png").convert("RGBA")
icon.resize((256, 256), Image.Resampling.LANCZOS).save(
    BUILD / "caveqis.ico", sizes=[(size, size) for size in (16, 24, 32, 48, 64, 128, 256)]
)

shutil.copyfile(Path(sys.base_prefix) / "LICENSE.txt", NOTICES / "Python-LICENSE.txt")

for name in (
    "Flask", "Werkzeug", "Jinja2", "MarkupSafe", "itsdangerous", "click",
    "blinker", "waitress", "sympy", "mpmath", "pyinstaller", "pillow", "setuptools",
):
    package = distribution(name)
    for source in package.files or ():
        if ".dist-info/" in source.as_posix() and source.name.upper().startswith(
            ("LICENSE", "COPYING", "NOTICE", "AUTHORS", "COPYRIGHT")
        ):
            target = NOTICES / source
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source.locate(), target)
