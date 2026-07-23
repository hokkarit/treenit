function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function todayKey() {
  const d = new Date();
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function jumpToToday(sheet) {
  const key  = todayKey();
  const data = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sheet.setActiveRange(sheet.getRange(i + 1, 1));
      return;
    }
  }
}

// Piilottaa menneet viikot ja merkitsee tämän päivän keltaisella jokaisessa tabissa
function onOpen() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();

  SpreadsheetApp.getUi()
    .createMenu('📅 Kotitreenit')
    .addItem('Hyppää tähän päivään', 'goToToday')
    .addItem('Näytä kaikki rivit', 'showAllRows')
    .addToUi();

  const key = todayKey();

  ss.getSheets().forEach(sheet => {
    const lastRow = sheet.getLastRow();

    // Näytä ensin kaikki rivit jotta edellinen tila ei jää päälle
    sheet.showRows(1, lastRow);

    const data        = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
    const currentWeek = isoWeek(new Date());
    const keyShort    = `${new Date().getDate()}.${new Date().getMonth() + 1}.`;

    let todayRow           = -1;
    let currentWeekRow     = -1;

    for (let i = 0; i < data.length; i++) {
      const val = data[i][0].trim();

      // Etsi nykyisen viikon "Viikko X" -rivi viikkonumerolla
      const wm = val.match(/^Viikko\s+(\d+)/i);
      if (wm && parseInt(wm[1]) === currentWeek) currentWeekRow = i + 1;

      // Etsi tämän päivän rivi — tunnistaa "23.7.2026", "23.7." ja "ke 23.7." -muodot
      if (todayRow < 0 && (val === key || val === keyShort ||
          val.endsWith(' ' + key) || val.endsWith(' ' + keyShort))) {
        todayRow = i + 1;
      }
    }

    // Piilota kaikki rivit ennen nykyisen viikon otsikkoa
    if (currentWeekRow > 2) {
      sheet.hideRows(2, currentWeekRow - 2);
    }

    // Korosta tämä päivä keltaisella
    if (todayRow > 0) {
      sheet.getRange(todayRow, 1, 1, 6).setBackground('#fff176').setFontColor('#000000');
      sheet.setActiveRange(sheet.getRange(todayRow, 1));
    } else if (currentWeekRow > 0) {
      sheet.setActiveRange(sheet.getRange(currentWeekRow, 1));
    }
  });
}

// Palauttaa kaikki rivit näkyviin aktiivisessa tabissa
function showAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.showRows(1, sheet.getLastRow());
}

// Hyppää tämän päivän riville aktiivisessa tabissa
function goToToday() {
  jumpToToday(SpreadsheetApp.getActiveSpreadsheet().getActiveSheet());
}

// Harmaannuttaa viikon rivit kun toistoluku valitaan alasvetovalikosta
function onEdit(e) {
  const range = e.range;
  if (range.getColumn() !== 6) return;

  const sheet = range.getSheet();
  const row   = range.getRow();
  const cellA = sheet.getRange(row, 1).getValue();
  if (!/^Viikko\s+\d+/i.test(String(cellA))) return;

  const value    = range.getValue();
  const isRepeat = value !== '' && !isNaN(parseInt(value, 10));

  const lastRow = sheet.getLastRow();
  let endRow = lastRow;
  for (let r = row + 1; r <= lastRow; r++) {
    if (/^Viikko\s+\d+/i.test(String(sheet.getRange(r, 1).getValue()))) {
      endRow = r - 1;
      break;
    }
  }

  if (endRow >= row + 1) {
    const weekRange = sheet.getRange(row + 1, 1, endRow - row, 6);
    if (isRepeat) {
      weekRange.setBackground('#d0d0d0').setFontColor('#888888');
    } else {
      weekRange.setBackground(null).setFontColor(null);
    }
  }
}

function populateData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const YEAR = 2026;

  const DAY_ABBR = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

  const challenges = {
    'U8': {
      '20.7.': ['Hypi tasajalkaa 30 kertaa', 'Heitä pallo ylöspäin ja ota kiinni 10 kertaa', '', ''],
      '21.7.': ['Lepopäivä', '', '', ''],
      '22.7.': ['Mailankäsittely: siirrä kiekko edestakaisin 1 min', 'Tee 3 kuperkeikkaa', '', ''],
      '23.7.': ['Lepopäivä', '', '', ''],
      '24.7.': ['Seiso yhdellä jalalla 20 sek, vaihda jalka', 'Juokse takapihalla 5 min', '', ''],
      '25.7.': ['Pelaa ulkona kavereiden kanssa 20 min', '', '', ''],
      '26.7.': ['Lepopäivä', '', '', ''],
      '27.7.': ['Hypi tasajalkaa 50 kertaa', 'Heitä pallo seinään ja ota kiinni 2 min', '', ''],
      '28.7.': ['Lepopäivä', '', '', ''],
      '29.7.': ['Mailankäsittely: siirrä kiekko puolelta toiselle 2 min', 'Tee 5 kuperkeikkaa', '', ''],
      '30.7.': ['Lepopäivä', '', '', ''],
      '31.7.': ['Seiso yhdellä jalalla 30 sek, vaihda jalka', 'Juokse takapihalla 10 min', '', ''],
      '1.8.':  ['Pelaa ulkona kavereiden kanssa 30 min', '', '', ''],
      '2.8.':  ['Lepopäivä', '', '', ''],
    },
    'U9': {
      '20.7.': ['Kyykyt 2 × 8', 'Hyppynarua 1 min', '', ''],
      '21.7.': ['Lepopäivä', '', '', ''],
      '22.7.': ['Mailankäsittely 3 min: rysty ja käänto', 'Tasapaino: seiso yhdellä jalalla 20 sek', '', ''],
      '23.7.': ['Lepopäivä', '', '', ''],
      '24.7.': ['Juoksu 10 min', 'Venyttely jalat 5 min', '', ''],
      '25.7.': ['Pyöräily tai leikkiä ulkona 20 min', '', '', ''],
      '26.7.': ['Lepopäivä', '', '', ''],
      '27.7.': ['Kyykyt 2 × 10', 'Hyppynarua 2 min', '', ''],
      '28.7.': ['Lepopäivä', '', '', ''],
      '29.7.': ['Mailankäsittely 5 min: rysty ja käänto', 'Tasapaino: kävele viivaa pitkin eteen ja taakse', '', ''],
      '30.7.': ['Lepopäivä', '', '', ''],
      '31.7.': ['Juoksu 15 min', 'Venyttely jalat ja selkä 5 min', '', ''],
      '1.8.':  ['Pyöräily tai leikkiä ulkona 30 min', '', '', ''],
      '2.8.':  ['Lepopäivä', '', '', ''],
    },
    'U10': {
      '20.7.': ['Kyykyt 3 × 12', 'Hyppynarua 2 min', 'Punnerrukset 2 × 8', ''],
      '21.7.': ['Lepopäivä – palaudu hyvin', '', '', ''],
      '22.7.': ['Mailankäsittely 8 min: rysty ja käänto | https://youtu.be/VIDEO_ID', 'Vatsalihakset: 3 × 10 rutistusta', '', ''],
      '23.7.': ['Juoksu: 5 min lämmittely + 4 × 30 sek vauhdikas', 'Venyttely lonkat ja reidet 8 min', '', ''],
      '24.7.': ['Askelkyykyt 2 × 8 kummallakin jalalla', 'Lankku 3 × 20 sek', '', ''],
      '25.7.': ['Aerobinen: pyöräily tai uinti 30 min', '', '', ''],
      '26.7.': ['Lepopäivä', '', '', ''],
      '27.7.': ['Kyykyt 3 × 15', 'Hyppynarua 3 min', 'Punnerrukset 2 × 10', ''],
      '28.7.': ['Lepopäivä – palaudu hyvin', '', '', ''],
      '29.7.': ['Mailankäsittely 10 min: rysty, käänto ja taaksepäin', 'Vatsalihakset: 3 × 15 rutistusta', '', ''],
      '30.7.': ['Juoksu: 5 min lämmittely + 6 × 30 sek vauhdikas', 'Venyttely lonkat ja reidet 10 min', '', ''],
      '31.7.': ['Askelkyykyt 2 × 10 kummallakin jalalla', 'Lankku 3 × 30 sek', '', ''],
      '1.8.':  ['Aerobinen: pyöräily tai uinti 40 min', '', '', ''],
      '2.8.':  ['Lepopäivä', '', '', ''],
    },
    'U12': {
      '20.7.': ['Kyykyt 4 × 12', 'Askelkyykyt 3 × 10 kummallakin', 'Hyppynarua 3 min', ''],
      '21.7.': ['Mailankäsittely 8 min: rysty, käänto ja taaksepäin', 'Liikkuvuus: lonkat ja reidet 8 min', '', ''],
      '22.7.': ['Punnerrukset 3 × 12', 'Dipsit 3 × 8', 'Vatsalihas: 3 × 15 rutistusta', 'Sivulankku 3 × 25 sek'],
      '23.7.': ['Intervallijuoksu: 6 × 30 sek täysillä + 30 sek kävely', 'Venyttely koko keho 10 min', '', ''],
      '24.7.': ['Lankku 3 × 35 sek', 'Selkälihakset: 3 × 12', 'Hyppykyykyt 3 × 8', ''],
      '25.7.': ['Aerobinen: pyöräily tai uinti 40 min', '', '', ''],
      '26.7.': ['Lepopäivä', '', '', ''],
      '27.7.': ['Kyykyt 4 × 15', 'Askelkyykyt 3 × 12 kummallakin', 'Hyppynarua 4 min', ''],
      '28.7.': ['Mailankäsittely 10 min: nopeat siirrot ja taaksepäin', 'Liikkuvuus: lonkat ja reidet 10 min', '', ''],
      '29.7.': ['Punnerrukset 4 × 15', 'Dipsit 3 × 10', 'Vatsalihas: 3 × 20 rutistusta', 'Sivulankku 3 × 30 sek'],
      '30.7.': ['Intervallijuoksu: 8 × 30 sek täysillä + 30 sek kävely', 'Venyttely koko keho 10 min', '', ''],
      '31.7.': ['Lankku 3 × 45 sek', 'Selkälihakset: 3 × 15', 'Hyppykyykyt 3 × 10', ''],
      '1.8.':  ['Aerobinen: pyöräily tai uinti 50 min', '', '', ''],
      '2.8.':  ['Lepopäivä', '', '', ''],
    },
    'U14': {
      '20.7.': ['Kyykyt 4 × 18', 'Askelkyykyt 3 × 12 kummallakin', 'Nordic hamstring 3 × 6', 'Hyppynarua 4 min'],
      '21.7.': ['Mailankäsittely 12 min: nopeat siirrot, taaksepäin ja harhautukset', 'Liikkuvuus: lonkat, reidet, olkapäät 12 min', '', ''],
      '22.7.': ['Punnerrukset 4 × 15', 'Dipsit 4 × 10', 'Vatsalihas: 4 × 15 rutistusta', 'Sivulankku 3 × 35 sek'],
      '23.7.': ['Intervallijuoksu: 8 × 30 sek täysillä + 30 sek kävely', 'Laukaisuharjoitus: 40 laukausta seinään tai maaliin', 'Venyttely 10 min', ''],
      '24.7.': ['Lankku 4 × 50 sek', 'Selkälihakset: 3 × 12', 'Hyppykyykyt 4 × 8', 'Sivulankku 3 × 35 sek'],
      '25.7.': ['Aerobinen: pyöräily tai uinti 50 min', 'Keskivartalo: lankku 50 sek, sivulankku 35 sek, rutistus 15', '', ''],
      '26.7.': ['Lepopäivä', '', '', ''],
      '27.7.': ['Kyykyt 4 × 20', 'Askelkyykyt 3 × 15 kummallakin', 'Nordic hamstring 3 × 8', 'Hyppynarua 5 min'],
      '28.7.': ['Mailankäsittely 15 min: nopeat siirrot, taaksepäin ja harhautukset', 'Liikkuvuus: lonkat, reidet, olkapäät 15 min', '', ''],
      '29.7.': ['Punnerrukset 4 × 20', 'Dipsit 4 × 12', 'Vatsalihas: 4 × 20 rutistusta', 'Sivulankku 3 × 45 sek'],
      '30.7.': ['Intervallijuoksu: 10 × 30 sek täysillä + 30 sek kävely', 'Laukaisuharjoitus: 50 laukausta seinään tai maaliin', 'Venyttely 10 min', ''],
      '31.7.': ['Lankku 4 × 60 sek', 'Selkälihakset: 3 × 15', 'Hyppykyykyt 4 × 10', 'Sivulankku 3 × 45 sek'],
      '1.8.':  ['Aerobinen: pyöräily tai uinti 60 min', 'Keskivartalo: lankku 60 sek, sivulankku 45 sek, rutistus 20', '', ''],
      '2.8.':  ['Lepopäivä', '', '', ''],
    },
    'U16': {
      '20.7.': ['Takakyykyt 4 × 8', 'Askelkyykyt 3 × 12 kummallakin', 'Nordic hamstring 3 × 8', 'Hyppynarua 5 min'],
      '21.7.': ['Mailankäsittely 15 min: nopeat siirrot, harhautukset ja taaksepäin', 'Liikkuvuus + venyttely 15 min', '', ''],
      '22.7.': ['Punnerrukset 4 × 20', 'Dipsit 4 × 15', 'Vatsalihas: 4 × 25 + lankku 3 × 60 sek', 'Sivulankku 3 × 45 sek'],
      '23.7.': ['Intervallijuoksu: 10 × 30 sek täysillä + 30 sek kävely', 'Laukaisuharjoitus: 60 laukausta', 'Venyttely 12 min', ''],
      '24.7.': ['Hyppykyykyt 4 × 10, loikat 3 × 20 m', 'Selkälihakset: 4 × 15', 'Sivulankku 3 × 50 sek', ''],
      '25.7.': ['Aerobinen: pyöräily tai uinti 60 min', 'Keskivartalo: lankku 60 sek, sivulankku 50 sek, rutistus 25', '', ''],
      '26.7.': ['Lepopäivä – aktiivinen palautuminen: kävelylenkki 20 min', '', '', ''],
      '27.7.': ['Takakyykyt 4 × 10', 'Askelkyykyt 4 × 12 kummallakin', 'Nordic hamstring 3 × 10', 'Hyppynarua 6 min'],
      '28.7.': ['Mailankäsittely 18 min: kaikki tekniikat', 'Liikkuvuus + venyttely 15 min', '', ''],
      '29.7.': ['Punnerrukset 5 × 20', 'Dipsit 4 × 15', 'Vatsalihas: 5 × 25', 'Lankku 4 × 60 sek + sivulankku 3 × 50 sek'],
      '30.7.': ['Intervallijuoksu: 12 × 30 sek täysillä + 30 sek kävely', 'Laukaisuharjoitus: 60 laukausta', 'Venyttely 12 min', ''],
      '31.7.': ['Hyppykyykyt 4 × 12, loikat 4 × 20 m', 'Selkälihakset: 4 × 15', 'Sivulankku 4 × 50 sek', ''],
      '1.8.':  ['Aerobinen: pyöräily tai uinti 70 min', 'Keskivartalo: lankku 70 sek, sivulankku 55 sek, rutistus 25', '', ''],
      '2.8.':  ['Lepopäivä – aktiivinen palautuminen', '', '', ''],
    },
    'U18': {
      '20.7.': ['Takakyykyt 5 × 5 (raskas)', 'Askelkyykyt 4 × 12 kummallakin', 'Nordic hamstring 4 × 8', 'Hyppykyykyt 3 × 8'],
      '21.7.': ['Mailankäsittely 20 min täysnopeudella', 'Liikkuvuus + venyttely 15 min', '', ''],
      '22.7.': ['Penkkipunnerrus tai dipsit 5 × 8', 'Leuanveto tai soutu 4 × 8', 'Vatsalihas: 5 × 25 + lankku 4 × 60 sek', 'Sivulankku 4 × 50 sek'],
      '23.7.': ['Sprinttiharjoitus: 8 × 60 m täysillä, 2 min palautus', 'Laukaisuharjoitus: 80 laukausta', 'Venyttely + jäähdyttely 15 min', ''],
      '24.7.': ['Loikat 4 × 30 m, hyppykyykyt 4 × 10, kevennyshypyt 3 × 8', 'Selkälihakset: 4 × 15', 'Sivulankku 4 × 55 sek', ''],
      '25.7.': ['Aerobinen: pyöräily tai uinti 75 min', 'Keskivartalo: lankku 75 sek, sivulankku 60 sek, rutistus 30', '', ''],
      '26.7.': ['Lepopäivä – ravinto ja uni kuntoon', '', '', ''],
      '27.7.': ['Takakyykyt 5 × 5 (raskas)', 'Askelkyykyt 4 × 12 kummallakin', 'Nordic hamstring 4 × 10', 'Hyppykyykyt 4 × 8'],
      '28.7.': ['Mailankäsittely 20 min täysnopeudella', 'Liikkuvuus + venyttely 15 min', '', ''],
      '29.7.': ['Penkkipunnerrus tai dipsit 5 × 10', 'Leuanveto tai soutu 4 × 10', 'Vatsalihas: 5 × 30 + lankku 4 × 70 sek', 'Sivulankku 4 × 55 sek'],
      '30.7.': ['Sprinttiharjoitus: 10 × 60 m täysillä, 2 min palautus', 'Laukaisuharjoitus: 80 laukausta', 'Venyttely + jäähdyttely 15 min', ''],
      '31.7.': ['Loikat 4 × 30 m, hyppykyykyt 4 × 12, kevennyshypyt 4 × 8', 'Selkälihakset: 4 × 15', 'Sivulankku 4 × 60 sek', ''],
      '1.8.':  ['Aerobinen: pyöräily tai uinti 80 min', 'Keskivartalo: lankku 80 sek, sivulankku 65 sek, rutistus 30', '', ''],
      '2.8.':  ['Lepopäivä – ravinto ja uni kuntoon', '', '', ''],
    },
  };

  // Generate all dates 1.1.–31.12.
  const allDates = [];
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(YEAR, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      allDates.push(new Date(YEAR, month, day));
    }
  }

  for (const [teamName, teamChallenges] of Object.entries(challenges)) {
    let sheet = ss.getSheetByName(teamName);
    if (!sheet) {
      sheet = ss.insertSheet(teamName);
    } else {
      sheet.clearContents();
      sheet.clearFormats();
    }

    // 6 columns: Päivämäärä | Viikonpäivä | Haaste 1 | Haaste 2 | Haaste 3 | Haaste 4
    const rows     = [['Päivämäärä', 'Viikonpäivä', 'Haaste 1', 'Haaste 2', 'Haaste 3', 'Haaste 4']];
    const weekRows = [];
    let lastWeek   = -1;

    for (const date of allDates) {
      const weekNum = isoWeek(date);

      if (weekNum !== lastWeek) {
        weekRows.push(rows.length + 1);
        // Kirjoita "Toista: 23" Haaste 1 -soluun (sarake C) toistaaksesi viikon 23 ohjelman
        rows.push([`Viikko ${weekNum}`, '', '', '', 'Toista viikko:', '']);
        lastWeek = weekNum;
      }

      const lookupKey = `${date.getDate()}.${date.getMonth() + 1}.`;
      const dateStr   = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;  // "20.7.2026"
      const dayAbbr = DAY_ABBR[date.getDay()];     // "ma", "ti", ...
      const ch      = teamChallenges[lookupKey] || ['', '', '', ''];

      rows.push([dateStr, dayAbbr, ch[0], ch[1], ch[2], ch[3]]);
    }

    sheet.getRange(1, 1, rows.length, 6).setValues(rows).setWrap(true);

    // Style main header
    sheet.getRange(1, 1, 1, 6)
      .setBackground('#0A1628')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    // Dropdown "Toista: 1"–"Toista: 52" in col C of each week header row
    const repeatOptions = Array.from({length: 52}, (_, i) => String(i + 1));
    const repeatRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(repeatOptions, true)
      .setAllowInvalid(true)
      .build();

    // Style week header rows + add dropdown
    for (const rowIdx of weekRows) {
      sheet.getRange(rowIdx, 1, 1, 6)
        .setBackground('#1a2a42')
        .setFontColor('#4FC3F7')
        .setFontWeight('bold');
      sheet.getRange(rowIdx, 6).setDataValidation(repeatRule);
    }

    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 6, 250);

    const maxCols = sheet.getMaxColumns();
    if (maxCols > 6) sheet.deleteColumns(7, maxCols - 6);
  }

  ss.toast(
    'Sarakkeet: Päivämäärä | Viikonpäivä | Haaste 1–4 | Toista viikko: | #',
    'Valmis! Kaikki 7 välilehteä luotu.',
    10
  );
}
