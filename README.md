# Level-1 Tajweed Notes PDF Viewer

This version keeps the same warm beige look and layout as the original Juz 30 PDF viewer, but the content has been changed for Level-1 Tajweed notes.

## What changed

- Uses `notes.json` instead of `surahs.json`.
- Uses Tajweed note labels instead of Surah labels.
- Keeps English note titles and Urdu topic names in the sidebar.
- Keeps the original warm Quran-viewer style: beige background, soft panels, brown accent buttons, rounded PDF cards.
- Mobile friendly layout with a slide-out notes list.
- PDF pages open in scroll mode by default on desktop and mobile, so users can swipe/scroll through pages without clicking page arrows.
- Page arrows still work as shortcuts.

## How to add your PDFs

1. Put your PDF files inside the `files` folder.
2. Open `notes.json`.
3. Update each `file` value so it matches your exact English PDF filename.

Example:

```json
{
  "number": 1,
  "title": "Tajweed laghvi mane",
  "urdu": "تجوید کے لغوی معنی",
  "file": "files/01-tajweed-laghvi-mane.pdf"
}
```

Keep file names in English and avoid spaces if possible. Example: `01-tajweed-laghvi-mane.pdf`.

## Main files

- `index.html` - page layout and text
- `style.css` - warm beige visual design and mobile responsive styles
- `script.js` - PDF viewer logic
- `notes.json` - note titles, Urdu labels, and PDF file paths
- `files/` - folder for your PDF notes

## Ideas you can also add back to the Quran viewer code

- Keep mobile in scroll mode by default so readers can swipe through all PDF pages.
- Add a bottom mobile nav with previous, list, and next buttons.
- Keep the page number input as a quick jump, but do not make it the only navigation method.
- Add a clear download button for each PDF.
- Add a secondary label line in the list, such as translation, Urdu title, or short description.
- Add a search/filter box above the sidebar list if the list gets long.
- Add a "last opened" feature using `localStorage` so the viewer reopens the last PDF and page.
