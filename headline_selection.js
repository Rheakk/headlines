Qualtrics.SurveyEngine.addOnload(function () {
  var q = this;

  // GitHub Pages CSV URL
  var csvUrl = "https://rheakk.github.io/headlines/headlines_with_neutral_and_cuemap.csv";

  // Hide this question so respondents never see it
  q.getQuestionContainer().style.display = "none";

  // --- CSV parser (handles quotes, commas in quotes, CRLF, etc.) ---
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      var next = text[i + 1];

      if (c === '"' && inQuotes && next === '"') {
        field += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (c === "," && !inQuotes) {
        row.push(field);
        field = "";
        continue;
      }
      if ((c === "\n" || c === "\r") && !inQuotes) {
        if (c === "\r" && next === "\n") i++;
        row.push(field);
        field = "";
        if (row.some(function (x) { return (x || "").trim() !== ""; })) rows.push(row);
        row = [];
        continue;
      }
      field += c;
    }

    if (field.length || row.length) {
      row.push(field);
      if (row.some(function (x) { return (x || "").trim() !== ""; })) rows.push(row);
    }

    return rows;
  }

  function shuffleInPlace(arr) {
    for (var j = arr.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = arr[j]; arr[j] = arr[k]; arr[k] = tmp;
    }
  }

  function sampleWithoutReplacement(arr, n) {
    var copy = arr.slice();
    shuffleInPlace(copy);
    return copy.slice(0, Math.min(n, copy.length));
  }

  function findCol(header, name) {
    var h = header.map(function (x) { return (x || "").trim().toLowerCase(); });
    return h.indexOf(name.toLowerCase());
  }

  function normalizeDim(dim) {
    dim = (dim || "").trim().toLowerCase();
    if (dim === "credible") dim = "credibility";
    if (dim === "engaging") dim = "engagement";
    return dim;
  }

  function setED(n, item) {
    Qualtrics.SurveyEngine.setEmbeddedData("S" + n + "_Title", item ? item.title : "");
    Qualtrics.SurveyEngine.setEmbeddedData("S" + n + "_Cue", item ? item.cue : "");
    Qualtrics.SurveyEngine.setEmbeddedData("S" + n + "_Dimension", item ? item.dim : "");
  }

  // Add cache-buster so you always get the latest GitHub Pages file
  var cacheBustedUrl = csvUrl + (csvUrl.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();

  fetch(cacheBustedUrl, {
    method: "GET",
    cache: "no-store",
    credentials: "omit"
  })
    .then(function (resp) {
      if (!resp.ok) throw new Error("CSV fetch failed (HTTP " + resp.status + ")");
      return resp.text();
    })
    .then(function (csvText) {
      var table = parseCSV(csvText);
      if (!table || table.length < 2) throw new Error("CSV has no data rows.");

      var header = table[0];

      // ✅ Your CSV uses Title, dimension, cue_no (not cue#)
      var idxTitle = findCol(header, "title");
      var idxDim   = findCol(header, "dimension");
      var idxCue   = findCol(header, "cue_no"); // <-- changed

      if (idxTitle < 0 || idxDim < 0) {
        throw new Error("Missing required columns: Title, dimension");
      }
      if (idxCue < 0) {
        throw new Error("Missing required column: cue_no");
      }

      var rows = [];
      for (var i = 1; i < table.length; i++) {
        var r = table[i];
        if (!r) continue;

        var title = (r[idxTitle] || "").trim();
        var dim   = normalizeDim(r[idxDim]);
        var cue   = (r[idxCue] || "").trim();

        if (!title || !dim) continue;
        rows.push({ title: see(title), cue: cue, dim: dim });
      }

      // Small helper to keep titles clean if they include escaped quotes
      function see(s) { return (s || "").replace(/\s+/g, " ").trim(); }

      var neutral = rows.filter(function (r) { return r.dim === "neutral"; });
      var cred    = rows.filter(function (r) { return r.dim === "credibility"; });
      var eng     = rows.filter(function (r) { return r.dim === "engagement"; });

      // ✅ Require enough rows to sample 6 from each dimension
      if (neutral.length < 6) throw new Error("Not enough NEUTRAL rows (need >= 6, have " + neutral.length + ")");
      if (cred.length < 6)    throw new Error("Not enough CREDIBILITY rows (need >= 6, have " + cred.length + ")");
      if (eng.length < 6)     throw new Error("Not enough ENGAGEMENT rows (need >= 6, have " + eng.length + ")");

      var picked = []
        .concat(sampleWithoutReplacement(neutral, 6))
        .concat(sampleWithoutReplacement(cred, 6))
        .concat(sampleWithoutReplacement(eng, 6));

      // Randomize order across the 18
      shuffleInPlace(picked);

      // ✅ Populate embedded data fields S1..S18
      for (var n = 1; n <= 18; n++) setED(n, picked[n - 1]);

      Qualtrics.SurveyEngine.setEmbeddedData("StimuliCsvUrlUsed", cacheBustedUrl);

      window.setTimeout(function () {
        q.clickNextButton();
      }, 150);
    })
    .catch(function (err) {
      console.error("Loader error:", err);

      q.getQuestionContainer().style.display = "block";
      q.getQuestionContainer().innerHTML =
        "<div style='color:#b00020;font-family:monospace;white-space:pre-wrap'>" +
        "Error loading stimuli:\n" + (err && err.message ? err.message : String(err)) +
        "</div>";
    });
});
