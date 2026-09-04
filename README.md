# Pizzeria Mama – Online-Bestellsystem

Eine schlanke Bestell-Website für die Pizzeria Mama, aufgebaut nach dem
gleichen Prinzip wie das Picknick-Grill-Bestellsystem: Kunden stellen sich
online ihr Essen zusammen und bestellen zur Abholung. Der Inhaber sieht neue
Bestellungen im Admin-Bereich, bestätigt sie und gibt eine Abholzeit vor –
der Kunde sieht diese dann live auf seiner Status-Seite ("Du kannst dein
Essen um 18:30 Uhr abholen").

## Funktionen

- **Speisekarte** (`/`) – alle Gerichte aus der aktuellen Karte, nach
  Kategorien sortiert, mit Warenkorb und Bestellformular (Name,
  Telefonnummer, Wunsch-Abholzeit, Anmerkung). Pizzen und andere Gerichte
  mit zwei Größen (z. B. klein/groß) lassen sich direkt beim Hinzufügen
  zum Warenkorb auswählen.
- **Bestellstatus** (`/status.html`) – Kunden geben Bestellnummer + Code ein
  und sehen live: *"wartet auf Bestätigung"* → *"bestätigt, Abholung um
  HH:MM Uhr"* → *"fertig, bitte abholen"* → *"abgeholt"*. Die Seite aktualisiert
  sich automatisch alle paar Sekunden, solange die Bestellung offen ist.
- **Admin-Bereich** (`/admin`) – passwortgeschützt. Zeigt alle offenen
  Bestellungen mit Artikeln, Größen, Namen und Telefonnummer. Der Inhaber
  trägt eine Abholzeit ein und bestätigt die Bestellung, meldet sie später
  als "fertig" oder "abgeholt", oder storniert sie.

Bezahlt wird bar oder mit EC-Karte bei Abholung vor Ort – es ist keine
Online-Zahlung eingebaut.

## Lokal starten

```bash
npm install
cp .env.example .env
# .env öffnen und ADMIN_PASSWORD + SESSION_SECRET setzen
npm start
```

Danach:
- Speisekarte: http://localhost:3000
- Admin-Bereich: http://localhost:3000/admin/login.html

## Vor dem Livegang unbedingt noch ausfüllen

Adresse und Telefonnummer stehen aktuell als Platzhalter in
[`public/index.html`](public/index.html), [`public/status.html`](public/status.html)
und [`public/admin/index.html`](public/admin/index.html) sowie in den
Fehlermeldungen in [`server.js`](server.js) (z. B. bei stornierten
Bestellungen) – bitte durch die echten Kontaktdaten ersetzen. Fotos (Header-
Bild, "Beliebt"-Karten) können in `public/img/` ergänzt werden, siehe die
Hinweise in `public/img/BILDER-HIER-EINFUEGEN.txt`.

## Die Speisekarte anpassen

Alle Gerichte und Preise stehen in [`data/menu.json`](data/menu.json), genau
wie beim Picknick-Grill-System. Da viele Pizzen und Salate zwei Größen
(klein/groß) haben, stehen diese als zwei eigenständige Einträge mit
jeweils festem Preis in der Karte (z. B. `"Margherita mit Gouda-Käse klein"`
und `"Margherita mit Gouda-Käse groß"`) – kein Kunde kann sich also bei der
Größe vertun, jede Zeile hat einen eindeutigen Namen und Preis.

Jeder Artikel besteht aus `"name"` und `"price"`. Optional:

- `"sauceOptions"`: Array mit Soßen zur Auswahl (wie beim Picknick-Grill,
  z. B. `["Keine Soße", "Ketchup", "Mayo"]`) – aktuell nutzt kein Gericht
  der Pizzeria-Karte das, kann aber jederzeit ergänzt werden.
- `"popular": true` – erscheint oben in "Beliebte Gerichte".
- `"img": "dateiname.webp"` – Foto für die Beliebt-Karte, Datei in
  `public/img/` ablegen.

Einfach Einträge ändern, hinzufügen oder löschen – die Website übernimmt
das automatisch. Preise werden serverseitig aus dieser Datei berechnet,
Kunden können also keine falschen Preise übermitteln.

## Bestellungen (Daten)

Bestellungen werden in `data/orders.json` gespeichert (wird beim ersten
Start automatisch angelegt, ist nicht Teil von Git). Für den Betrieb auf
einem Server reicht das für ein Pizzeria-Bestellaufkommen problemlos aus.

## Deployment (online stellen)

Der Server ist ein normales Node.js/Express-Programm und läuft auf jedem
Anbieter, der Node.js unterstützt (z. B. Render, Railway, ein eigener
vServer). Wichtig für den Live-Betrieb:

1. `ADMIN_PASSWORD` und `SESSION_SECRET` als Umgebungsvariablen setzen
   (nicht die Beispielwerte verwenden).
2. `npm install` und `npm start` als Start-Befehl hinterlegen.
3. Eine eigene Domain (oder Subdomain) auf den Dienst zeigen lassen.
4. Optional: HTTPS aktivieren (die meisten Hosting-Anbieter machen das
   automatisch).

### Deployment auf Render

Das Repo enthält eine fertige [`render.yaml`](render.yaml) (Render
"Blueprint"), die Web-Service, dauerhafte Festplatte für die Bestellungen
und `SESSION_SECRET` automatisch einrichtet:

1. Bei [render.com](https://render.com) einloggen (oder Account anlegen).
2. **New +** → **Blueprint** → dieses GitHub-Repo
   (`michapeterson-del/Pizzeria-Mama`) auswählen. Render erkennt die
   `render.yaml` automatisch.
3. Beim Anlegen nach `ADMIN_PASSWORD` fragen lassen und ein eigenes,
   sicheres Passwort eintragen (wird nicht automatisch generiert, da du
   es dir merken musst). `SESSION_SECRET` erzeugt Render selbst zufällig.
4. **Apply** klicken – Render baut und startet den Dienst automatisch.
   Bestellungen landen dank der eingerichteten Persistent Disk
   (`/var/data`) dauerhaft und überstehen Neustarts/Deploys.
5. Nach dem ersten Deploy ist die Seite unter der von Render vergebenen
   `*.onrender.com`-Adresse erreichbar; optional eine eigene Domain unter
   **Settings → Custom Domains** hinterlegen.

Hinweis: Auf dem kostenlosen Render-Plan schläft der Dienst nach
Inaktivität ein und der erste Aufruf danach dauert einige Sekunden länger
("Cold Start") – für den Live-Betrieb lohnt sich ggf. ein bezahlter Plan.

## Mögliche Erweiterungen (nicht enthalten)

- SMS/WhatsApp-Benachrichtigung an den Kunden, sobald die Bestellung
  bestätigt ist (aktuell muss der Kunde die Status-Seite offen halten oder
  später erneut aufrufen).
- Online-Bezahlung.
- Mehrere Mitarbeiter-Logins im Admin-Bereich.
