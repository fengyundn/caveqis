"""Prepare application icons and collect licenses for bundled components."""

from importlib.metadata import distribution
from pathlib import Path
import shutil
import sys
import sysconfig

from PIL import Image


DESKTOP = Path(__file__).resolve().parent
BUILD = DESKTOP / ".build"
NOTICES = BUILD / "licenses"
NOTICES.mkdir(parents=True, exist_ok=True)

icon = Image.open(DESKTOP.parent / "static" / "caveqis.png").convert("RGBA")
large_icon = icon.resize((256, 256), Image.Resampling.LANCZOS)
large_icon.save(BUILD / "icon.png")
large_icon.save(
    BUILD / "caveqis.ico", sizes=[(size, size) for size in (16, 24, 32, 48, 64, 128, 256)]
)
python_license = Path(sys.base_prefix) / "LICENSE.txt"
if not python_license.is_file():
    python_license = Path(sysconfig.get_path("stdlib")) / "LICENSE.txt"
if not python_license.is_file() and sys.platform == "linux":
    python_license = Path(f"/usr/share/doc/python{sys.version_info.major}.{sys.version_info.minor}/copyright")
shutil.copyfile(python_license, NOTICES / "Python-LICENSE.txt")

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
