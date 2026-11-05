# Spines

A cozy book tracker for your phone. Your books stand as colorful spines on three shelves, and opening one feels like turning to a sheet of paper with your rating, notes and quotes. It works offline, needs no account, and keeps all data on the device.

## Screens

| Screen | What it shows |
|--------|---------------|
| **Home** | Three shelves (Reading, Want to read, Finished), newest books first, plus your yearly goal if you set one |
| **Book page** | Shelf, rating and finish date, notes on ruled lines, and quotes with page numbers |
| **All books on a shelf** | A searchable list; tap a shelf's title on Home to open it |
| **Year in books** | That year's finished books on one shelf, plus your totals |
| **Settings** | Goal, categories, language and backup |

## How to use

- **Add a book:** tap **+ Add a book**. Only the title is required, and you can fill in the rest later.
- **Open a book:** tap its spine. Each shelf scrolls sideways when it fills up.
- **Move a book:** use the shelf buttons on its page. Moving it to **Finished** fills in today's date, which you can change, and asks for a rating, which you can skip.
- **Rate a book:** tap the stars on a finished book. Tap the same star again to remove the rating.
- **Change or delete a book:** tap **Edit** on its page.
- **See your year:** tap the goal bar on Home, or go to **Settings → Year in books**.

**Language:** the app comes in English and Italian. The first time, it follows the phone's language; to change it, go to **Settings → Language**.

The app always stays in light mode, even if the phone uses dark mode.

## How spines work

**Thickness** comes from the page count, between fixed limits:

| Pages | Thickness |
|-------|-----------|
| Up to 100 | 26 px (the minimum) |
| 250 | 36 px |
| 350 | 42 px |
| 500 or more | 52 px (the maximum) |
| Not filled in | 39 px |

**Height** varies a little per book, just for looks.

**Color** depends on categories, which are optional:

| How you use categories | What spines look like |
|------------------------|-----------------------|
| No book has one | Colorful automatic colors |
| Some books have one | Those books use their category's color, and the rest use soft neutral shades |

You can have up to 10 categories, each with its own color. Tap a category above the shelves to show only its books. Change categories in **Settings**.

## How the numbers work

- **Yearly goal:** counts finished books with a finish date in that year, so adding an old book with an older date doesn't change this year's progress. A finished book with no date isn't counted at all.
- **Pages read:** adds up the books that have a page count.
- **Average rating:** counts rated books only.
- **Busiest month:** the month with the most finished books; if there's a tie, the earlier one.

## Your data

Everything is stored on the phone, in the browser's local storage. Nothing is ever sent anywhere, and nothing is stored in this repo.

App updates don't touch your data, but clearing Chrome's data or changing phones erases it. To keep a copy, use **Settings → Export backup**, and **Import backup** to restore it. Importing replaces everything currently in the app. The app gently reminds you if you've made changes and haven't backed up for 30 days.

## Install on Android

Open the GitHub Pages address in Chrome, then tap **⋮ → Install app**. The app then opens full-screen from your home screen and works offline.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page shell |
| `styles.css` | Colors, shelves and the paper look |
| `lang.js` | All the text, in English and Italian |
| `app.js` | Books, shelves, categories, goal, statistics and backup |
| `manifest.webmanifest` | App name, colors and icons for "Install app" |
| `sw.js` | Offline support |
| `icons/` | App icons (SVG source + 192 / 512 px PNG) |

There are no libraries and no build step.

After changing any app file, bump `VERSION` in `sw.js` (e.g. `'v1'` → `'v2'`) so installed copies update.

To try the app with sample books, add `?demo` to the address and open Settings. **Load sample books** and **Reset everything** both replace your data, so don't use them on the copy you track with.

## Credits

Made by gionzana. If you enjoy it, you can [buy me a coffee](https://buymeacoffee.com/gionzana) ☕
