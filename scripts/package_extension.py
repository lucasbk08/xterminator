"""Gera um ZIP somente com os arquivos públicos da extensão."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "edge-extension"
FILES = (
    "manifest.json", "background.js", "bootstrap.js", "filters.js", "delete.js",
    "simulate.js", "popup.html", "popup.css", "popup.js", "README.md", "PRIVACY.md", "LICENSE",
)


def main():
    if EXTENSION.is_symlink():
        raise SystemExit("A pasta da extensão não pode ser um link simbólico.")
    for name in FILES:
        path = EXTENSION / name
        if path.is_symlink() or not path.is_file():
            raise SystemExit(f"Arquivo público ausente ou link simbólico: {name}")
    manifest = json.loads((EXTENSION / "manifest.json").read_text())
    version = manifest["version"]
    if not isinstance(version, str) or not all(part.isdigit() for part in version.split(".")):
        raise SystemExit("Versão inválida.")
    output = ROOT / "dist" / f"xterminator-extension-{version}.zip"
    if output.parent.is_symlink() or output.is_symlink():
        raise SystemExit("O destino do pacote não pode ser um link simbólico.")
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for name in FILES:
            archive.write(EXTENSION / name, name)
    with ZipFile(output) as archive:
        if archive.testzip() is not None or set(archive.namelist()) != set(FILES):
            raise SystemExit("Falha ao verificar o pacote.")
    print(output.relative_to(ROOT))


if __name__ == "__main__":
    main()
