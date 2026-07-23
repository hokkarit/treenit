# Kotitreenit

Mobiiliystävällinen PWA-sovellus juniorijoukkueiden viikkotehtäville. Joukkueille lisätään viikoittaisia kotona tehtäviä harjoitushaasteita, jotka pelaajat voivat kuitata tehdyiksi puhelimellaan.

## Ominaisuudet

- Joukkuekohtaiset viikko-ohjelmat
- Tehtävien kuittaus – tallennetaan selaimen `localStorage`-muistiin
- Viikkonavigaatio nuolipainikkeilla, näppäimistöllä (← →) tai pyyhkäisemällä
- Tämän päivän kortti korostettuna ja automaattisesti näkyvissä
- Tilastonäkymä (⋯ → Tilastot)
- Edistymisen vienti/tuonti JSON-tiedostona
- Aamumuistutus klo 9 (jos selain tukee ilmoituksia)
- Toimii offline-tilassa (Service Worker)
- Asennettavissa kotinäyttöön (PWA)

## Rakenne

```
treenit.hokkarit.fi/
├── index.html
├── manifest.json
├── sw.js
├── css/style.css
├── js/app.js
└── data/
    ├── clubs.json              # Seurojen lista
    ├── hokkarit/
    │   └── teams.json          # Hokkarit-joukkueet
    └── weeks/
        └── hokkarit/
            ├── U8/
            │   └── 2026-W19.json
            └── ...
```

## Paikallinen kehitysympäristö

Service Worker vaatii HTTP-yhteyden – `file://`-protokolla ei toimi. Käynnistä paikallinen palvelin projektin juurihakemistossa:

```bash
python3 -m http.server 8765
# tai
npx serve .
```

Avaa selaimessa: `http://localhost:8765`

## Datamalli

### clubs.json

```json
[
  {
    "id": "hokkarit",
    "name": "Hokkarit",
    "logo": "https://static.jopox.fi/hokkarit/logos/logo-300.png"
  }
]
```

### data/{seura}/teams.json

```json
[
  { "id": "U10", "name": "Hokkarit U10" }
]
```

### Viikkotiedosto – perusrakenne

Tiedosto: `data/weeks/{seura}/{joukkue}/{vuosi}-W{vk}.json`

```json
{
  "team": "U10",
  "week": "2026-W20",
  "title": "Viikko 20 – Laukausiviikko 🎯",
  "days": {
    "monday": {
      "title": "Maanantai",
      "tasks": [
        "Tehtävä pelkkänä tekstinä",
        "Toinen tehtävä"
      ]
    },
    "tuesday":   { "title": "Tiistai",     "tasks": ["Lepopäivä"] },
    "wednesday": { "title": "Keskiviikko", "tasks": ["Tehtävä"] },
    "thursday":  { "title": "Torstai",     "tasks": ["Lepopäivä"] },
    "friday":    { "title": "Perjantai",   "tasks": ["Tehtävä"] },
    "saturday":  { "title": "Lauantai",    "tasks": ["Tehtävä"] },
    "sunday":    { "title": "Sunnuntai",   "tasks": ["Tehtävä"] }
  }
}
```

### Tehtävä lisätiedolla ja/tai YouTube-linkillä

Tehtävä voi olla joko pelkkä merkkijono **tai** objekti. Objektissa `text` on pakollinen, `info` ja `video` valinnaisia:

```json
"tasks": [
  "Yksinkertainen tehtävä (merkkijono)",
  {
    "text": "Tehtävä, jonka alla näkyy lisätietoa",
    "info": "Tee 3 sarjaa 10 toistoa. Pidä selkä suorana ja polvet varpaiden suuntaisina."
  },
  {
    "text": "Tehtävä YouTube-videolla",
    "video": "https://youtu.be/xxxxxxx"
  },
  {
    "text": "Tehtävä sekä lisätiedolla että videolla",
    "info": "Katso ensin video, sitten tee 3 × 30 s.",
    "video": "https://youtu.be/xxxxxxx"
  }
]
```

`info` näkyy tehtäväboksin alla harmaana tekstinä.  
`video` näkyy klikattavana "▶ Katso video" -linkkinä.

### Toistuva viikko-ohjelma

Jos viikko toistaa aiemman viikon sisällön, riittää lyhyt viitetiedosto:

```json
{ "team": "U10", "week": "2026-W24", "repeat": "2026-W20" }
```

Sovellus hakee automaattisesti viitatun viikon datan ja näyttää "Toistuva ohjelma" -huomautuksen.

## Uuden seura- tai joukkueen lisääminen

1. Lisää seura `data/clubs.json`-tiedostoon (id, name, logo-URL)
2. Luo `data/{seura}/teams.json` joukkuelistalla
3. Luo viikkotiedostot `data/weeks/{seura}/{joukkue}/` alle

## Viikonumeron selvittäminen

```bash
python3 -c "import datetime; print(datetime.date.today().isocalendar())"
```

## GitHub Pages -julkaisu

1. Luo repositorio ja pushaa `main`-haaraan
2. **Settings → Pages → Source: Deploy from branch → main / (root)**
3. Lisää custom domain ja DNS CNAME-tietue:

```
CNAME  treenit  hokkarit.github.io
```

GitHub Pages tarjoaa HTTPS:n automaattisesti.
