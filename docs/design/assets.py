"""
The widget mockups' assets, built from THE REPO'S OWN FILES rather than
committed as base64.

The first version of this harness lived in /tmp and carried a 254 KB module of
inlined fonts and photographs. Two problems with that: /tmp does not survive a
container reset (this repo has lost harnesses that way before), and a second
copy of a font or a station photo is a second thing that can drift from the one
the app actually ships. So it reads the real ones instead — which also means a
mockup can never show a station in a colour or a face the app does not have.

Run from the repo root, or set CRUISE_ROOT.
"""
import base64, os, pathlib

ROOT = pathlib.Path(os.environ.get('CRUISE_ROOT', '.')).resolve()

def _b64(rel):
    p = ROOT / rel
    if not p.exists():
        raise SystemExit(f"assets.py: missing {p}\nRun from the repo root, or set CRUISE_ROOT.")
    return base64.b64encode(p.read_bytes()).decode()

# The blurred station backdrops are the ones the modes actually draw, so a
# mockup gets the same softness a real deck has.
A = {
    'dseg7':    _b64('assets/fonts/DSEG7Classic-Bold.ttf'),
    'dseg14':   _b64('assets/fonts/DSEG14Classic-Bold.ttf'),
    'pixel':    _b64('assets/fonts/DotGothic16-Latin.ttf'),
    'coastal':  _b64('assets/stations/blur/coastal.jpg'),
    'downtown': _b64('assets/stations/blur/downtown.jpg'),
    'daylight': _b64('assets/stations/blur/daylight.jpg'),
    'nightrun': _b64('assets/stations/blur/night-run.jpg'),
}
