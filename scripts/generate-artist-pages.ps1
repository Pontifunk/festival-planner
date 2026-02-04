$ErrorActionPreference = "Stop"
$root = Get-Location
# NOTE: After snapshot updates, re-run this script to keep artist pages in sync.
$siteOrigin = $env:SITE_ORIGIN
if (-not $siteOrigin) { $siteOrigin = "https://festival-planner.org" }
$festival = $env:FESTIVAL
if (-not $festival) { $festival = "tomorrowland" }
$year = $env:YEAR
if (-not $year) { $year = "2026" }
$locale = $env:LOCALE
if (-not $locale) { $locale = "en" }
$locale = $locale.ToLower()

$ui = @{
  "en" = @{
    titleSuffix = "Festival Planner"
    subtitle = "Artist details (privacy-first, no tracking)"
    backToLineup = "Back to lineup"
    setTimes = "Set times"
    noSlots = "No slots available."
  }
  "de" = @{
    titleSuffix = "Festival Planner"
    subtitle = "Artist-Details (privacy-first, ohne Tracking)"
    backToLineup = "Zurueck zum Line-up"
    setTimes = "Set-Zeiten"
    noSlots = "Keine Slots verfuegbar."
  }
}
$copy = $ui[$locale]
if (-not $copy) { $copy = $ui["en"] }

$snapshotPath = Join-Path $root "data\$festival\$year\snapshots\latest.json"
$snapshot = Get-Content $snapshotPath -Raw | ConvertFrom-Json
$slots = @($snapshot.slots)

function Slugify([string]$value) {
  if (-not $value) { $value = "" }
  $norm = $value.Normalize([Text.NormalizationForm]::FormD)
  $chars = $norm.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne "NonSpacingMark" }
  $norm = -join $chars
  $norm = $norm.ToLower()
  $norm = $norm -replace "&", " and "
  $norm = $norm -replace "[^a-z0-9]+", "-"
  $norm = $norm -replace "-+", "-"
  $norm = $norm.Trim("-")
  if (-not $norm) { $norm = "artist" }
  return $norm
}

function EscapeHtml([string]$value) {
  if ($null -eq $value) { return "" }
  return ($value -replace "&","&amp;" -replace "<","&lt;" -replace ">","&gt;" -replace "`"","&quot;" -replace "'","&#039;")
}

function FormatDate([string]$value) {
  if (-not $value) { return "" }
  try { return (Get-Date $value).ToString("yyyy-MM-dd") } catch { return $value }
}

function FormatTime([string]$value) {
  if (-not $value) { return "" }
  $m = [regex]::Match($value, "(\d{2}:\d{2})")
  if ($m.Success) { return $m.Groups[1].Value }
  return ""
}

$weekends = @{}
foreach ($slot in $slots) {
  $weekend = [string]$slot.weekend
  if (-not $weekend) { continue }
  $weekend = $weekend.ToUpper()
  if (-not $weekends.ContainsKey($weekend)) { $weekends[$weekend] = @{} }
  $artists = $weekends[$weekend]
  $id = [string]$slot.artistId
  if (-not $id) { continue }
  if (-not $artists.ContainsKey($id)) {
    $artists[$id] = [ordered]@{ id=$id; name=[string]$slot.artist; normalized=[string]$slot.artistNormalized; slots=@() }
  }
  $artists[$id].slots += $slot
}

$baseUrls = @(
  "$siteOrigin/",
  "$siteOrigin/$festival/$year/w1/",
  "$siteOrigin/$festival/$year/w2/",
  "$siteOrigin/about/",
  "$siteOrigin/changelog/",
  "$siteOrigin/privacy/",
  "$siteOrigin/impressum/"
)
$sitemapUrls = New-Object System.Collections.Generic.HashSet[string]
foreach ($u in $baseUrls) { $null = $sitemapUrls.Add($u) }

foreach ($weekendKey in $weekends.Keys) {
  $artists = $weekends[$weekendKey]
  $weekendLower = $weekendKey.ToLower()
  $artistDir = Join-Path $root "$festival\$year\$weekendLower\artist"
  if (Test-Path $artistDir) { Remove-Item $artistDir -Recurse -Force }
  New-Item $artistDir -ItemType Directory -Force | Out-Null

  $baseById = @{}
  $counts = @{}
  foreach ($artist in $artists.Values) {
    $base = Slugify ($artist.normalized)
    if (-not $base) { $base = Slugify ($artist.name) }
    $baseById[$artist.id] = $base
    if (-not $counts.ContainsKey($base)) { $counts[$base] = 0 }
    $counts[$base] += 1
  }

  foreach ($artist in $artists.Values) {
    $base = $baseById[$artist.id]
    $suffix = ""
    if ($counts[$base] -gt 1) { $suffix = "-" + $artist.id.Substring(0, [Math]::Min(6, $artist.id.Length)) }
    $slug = "$base$suffix"

    $createdAt = [string]$snapshot.meta.createdAt
    $weekendNum = $weekendKey.Substring(1)
    $title = "$($artist.name) at Tomorrowland $year Weekend $weekendNum | $($copy.titleSuffix)"
    if ($locale -eq "de") {
      $description = "Set-Zeiten und Buehneninfos fuer $($artist.name) beim Tomorrowland $year Wochenende $weekendNum. Privacy-first, ohne Tracking."
    } else {
      $description = "Set times and stage info for $($artist.name) at Tomorrowland $year Weekend $weekendNum. Privacy-first, no tracking."
    }
    $canonical = "$siteOrigin/$festival/$year/$weekendLower/artist/$slug/"

    $sortedSlots = $artist.slots | Sort-Object @{Expression={ [string]($_.date) }}, @{Expression={ [string]($_.start) }}
    $slotItems = @()
    foreach ($slot in $sortedSlots) {
      $date = EscapeHtml ($slot.date)
      if (-not $date) { $date = EscapeHtml (FormatDate $slot.start) }
      $start = FormatTime $slot.start
      $end = FormatTime $slot.end
      $time = if ($start -and $end) { "$start-$end" } elseif ($start) { $start } elseif ($end) { $end } else { "" }
      $stage = EscapeHtml ($slot.stage)
      if (-not $stage) { $stage = "Unknown stage" }
      $slotItems += "<li><strong>$date</strong> - $(EscapeHtml $time) - $stage</li>"
    }
    if ($slotItems.Count -eq 0) { $slotItems = @("<li>$(EscapeHtml $copy.noSlots)</li>") }

    $snapshotMeta = ""
    if ($createdAt) { $snapshotMeta = "Snapshot: $(EscapeHtml $createdAt)" }
    $lineupUrl = "/$festival/$year/$weekendLower/"

    $jsonLd = @{
      "@context" = "https://schema.org"
      "@type" = "MusicGroup"
      "name" = $artist.name
      "url" = $canonical
    } | ConvertTo-Json -Depth 5 -Compress

    $html = @"
<!doctype html>
<html lang="$locale">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>$(EscapeHtml $title)</title>
  <meta name="description" content="$(EscapeHtml $description)">
  <link rel="canonical" href="$(EscapeHtml $canonical)">
  <meta property="og:title" content="$(EscapeHtml $title)">
  <meta property="og:description" content="$(EscapeHtml $description)">
  <meta property="og:url" content="$(EscapeHtml $canonical)">
  <meta property="og:type" content="website">
  <meta property="og:image" content="$siteOrigin/icons/og.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="$(EscapeHtml $title)">
  <meta name="twitter:description" content="$(EscapeHtml $description)">
  <meta name="twitter:image" content="$siteOrigin/icons/og.png">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">$jsonLd</script>
</head>
<body>
  <header class="topbar" id="top">
    <div class="brand">
      <div class="logo">FP</div>
      <div class="brandText">
        <div class="title">Festival Planner</div>
        <div class="subtitle">$(EscapeHtml $copy.subtitle)</div>
      </div>
    </div>
  </header>

  <main class="layout">
    <section class="panel">
      <div class="card">
        <div class="cardTitle">$(EscapeHtml $artist.name)</div>
        <div class="muted">Tomorrowland $year - Weekend $weekendNum</div>
        $(if ($snapshotMeta) { "<div class='muted' style='margin-top:6px'>$snapshotMeta</div>" } else { "" })
        <div style="margin-top:12px">
          <a class="btn" href="$lineupUrl">$(EscapeHtml $copy.backToLineup)</a>
        </div>
        <div style="margin-top:14px">
          <div class="muted" style="margin-bottom:6px">$(EscapeHtml $copy.setTimes)</div>
          <ul style="margin:0;padding-left:16px;display:flex;flex-direction:column;gap:6px">
            $(($slotItems -join "`n"))
          </ul>
        </div>
      </div>
    </section>
  </main>
</body>
</html>
"@

    $targetDir = Join-Path $artistDir $slug
    New-Item $targetDir -ItemType Directory -Force | Out-Null
    $targetFile = Join-Path $targetDir "index.html"
    Set-Content -Encoding UTF8 $targetFile -Value $html
    $null = $sitemapUrls.Add("$siteOrigin/$festival/$year/$weekendLower/artist/$slug/")
  }
}

$sitemapEntries = $sitemapUrls | Sort-Object | ForEach-Object { "  <url>`n    <loc>$($_)</loc>`n  </url>" }
$sitemapXml = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n" +
  "<urlset xmlns=`"https://www.sitemaps.org/schemas/sitemap/0.9`">`n" +
  ($sitemapEntries -join "`n") +
  "`n</urlset>`n"
Set-Content -Encoding UTF8 (Join-Path $root "sitemap.xml") -Value $sitemapXml

Write-Host "Generated artist pages for $($weekends.Keys.Count) weekends."
