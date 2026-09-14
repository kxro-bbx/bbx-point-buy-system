# BBX Point Buy — Made by KX

Die Seite ist eine statische Web-App (HTML/CSS/JavaScript). Sie kann z. B. auf GitHub Pages, Cloudflare Pages, Netlify oder Vercel gehostet werden.

## Enthalten

- 3 auswählbare Blades
- frei wählbares Punktebudget von 1 bis 28
- Presets 15 / 18 / 21 / 28, 18 als Empfehlung
- automatische Punkteberechnung und Budgetprüfung
- Zufallsdeck, Kopieren, Leeren
- Tab mit Punkteverteilung aller Blades
- Tab mit Regeln & Punktevergabe
- "Made by KX" im Footer
- lokaler Snapshot mit 125 Blades aus `BBX - Point Buy Meta`

## Automatische Updates aus Google Sheets

Die App kann die Blade-Liste bei jedem Seitenaufruf direkt aus einer CSV-Quelle laden.

1. Öffne dein Google Sheet.
2. Veröffentliche das gewünschte Tabellenblatt als CSV (Datei > Freigeben > Im Web veröffentlichen).
3. Kopiere die CSV-URL.
4. Öffne `config.js`.
5. Trage die URL hier ein:

```js
window.BBX_CONFIG = {
  SHEET_CSV_URL: "DEINE_CSV_URL_HIER",
  SHEET_NAME: "Tabellenblatt1",
  DEFAULT_BUDGET: 18,
  MAX_BUDGET: 28,
};
```

Die CSV muss mindestens die Spalten `Blade` und `Kosten` enthalten. Wenn die Live-Quelle nicht erreichbar ist, fällt die Seite automatisch auf `data/blades.json` zurück.

## Lokal testen

Wegen Browser-Sicherheitsregeln solltest du die Seite über einen kleinen lokalen Webserver öffnen, nicht direkt per Doppelklick auf `index.html`.

Beispiel mit Python:

```bash
python -m http.server 8080
```

Danach im Browser `http://localhost:8080` öffnen.

## Hosting

Für GitHub Pages: Dateien in ein Repository hochladen und Pages aktivieren. Für Netlify/Cloudflare Pages/Vercel reicht es ebenfalls, den Ordner als statische Website zu deployen.
