# Moon Magic app

A phone web app. Enter your birth data once, and it places the next New and Full Moon in your chart (house, degree, aspects) and gives you a practice page.

## Run it
```
cd app
python -m http.server 5317
```
Open http://127.0.0.1:5317. To install it on a phone it must be hosted over HTTPS (not set up yet).

## Edit the words
Everything the app says lives in `content/`:
- `lunations/NN-*.md`: one file per lunation, with `journal:` and `intention:` (New) or `release:` (Full) for each house. Change `status: draft` to `status: reviewed` when a file is done; that removes the "draft" mark.
- `moon-signs.md`: natal Moon profile + New/Full baseline lines.
- `principles.md`: the four numbered steps. Words in `{braces}` are filled in by the app.
- `houses.md`: one line per house.
- `signs.md`: the core theme of each sign (shown with today's Moon).
- `eclipses.md`: solar/lunar eclipse lines, North/South Node, natal contact (from book/05).
- `progressed.md`: progressed Moon by sign, house and phase. Drafted, not from the book.

Keep the shape: one `key: value` per line, `## 1st house` … `## 12th house`. `npm test` tells you the file and line if something's missing.

## Tests
`npm test` (Node 20+).
