# Measurement harnesses for the widget extension

Swift cannot be compiled in the environment this repo is worked on, so a
mistake in `targets/widgets/` is invisible until a build burns a cycle. These
are Python ports of the exact drawing maths in that target, kept so a look can
be MEASURED and DRAWN rather than reasoned about.

They are ports, not the shipping code — keep them in step by hand when the
Swift changes, and say so in the AGENTS.md entry that relies on one.

| Script | Answers |
|---|---|
| `titlebar.py` | What colour the Winamp title bar comes out for every accent the app can produce, and whether the type on it is readable. Prints hue, saturation, ink choice and contrast for all 10 built-in stations and all 25 custom swatches. |
| `cd.py` | Whether the CD's diffraction fans land where they were asked to and read as fans on silver rather than as a colour wheel. Renders `cd-fans.png` and prints saturation by bearing plus the spectrum along one fan. Needs Pillow. |
| `mirror-ball.py` | Brightness and colour spread across the mirror ball's visible tiles. Reports median, the share near white, and the share carrying real colour — brightness on that ball is a COUNT of mirrors catching a lamp, never a level, so the median alone will mislead. |
