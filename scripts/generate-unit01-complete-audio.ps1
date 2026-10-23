param(
  [string]$OutputDirectory = 'output/expression-course-drafts/unit01-complete-v2'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$root = (Get-Location).Path
$output = Join-Path $root $OutputDirectory
$sourcePath = Join-Path $root 'assets/expression-unit01-complete-lessons.json'
$source = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer

function Get-WaveDurationSeconds([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $channels = [BitConverter]::ToUInt16($bytes, 22)
  $sampleRate = [BitConverter]::ToUInt32($bytes, 24)
  $bitsPerSample = [BitConverter]::ToUInt16($bytes, 34)
  $offset = 12
  $dataLength = 0
  while ($offset + 8 -le $bytes.Length) {
    $chunk = [System.Text.Encoding]::ASCII.GetString($bytes, $offset, 4)
    $length = [BitConverter]::ToUInt32($bytes, $offset + 4)
    if ($chunk -eq 'data') { $dataLength = $length; break }
    $offset += 8 + $length + ($length % 2)
  }
  $bytesPerSecond = $sampleRate * $channels * $bitsPerSample / 8
  if ($bytesPerSecond -le 0 -or $dataLength -le 0) { throw "Invalid WAV header: $Path" }
  return [Math]::Round($dataLength / $bytesPerSecond, 3)
}

try {
  $speaker.SelectVoice('Microsoft Zira Desktop')
  New-Item -ItemType Directory -Path $output -Force | Out-Null
  $manifest = @()
  foreach ($lesson in $source.lessons) {
    foreach ($audio in $lesson.audio) {
      $target = Join-Path $output $audio.file
      if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite $target" }
      $speaker.Rate = [int]$audio.rate
      $speaker.SetOutputToWaveFile($target)
      $speaker.Speak([string]$audio.text)
      $speaker.SetOutputToNull()
      $item = Get-Item -LiteralPath $target
      $manifest += [pscustomobject]@{
        assetId = [string]$audio.assetId
        text = [string]$audio.text
        file = [string]$audio.file
        voice = $speaker.Voice.Name
        rate = [int]$audio.rate
        size = [long]$item.Length
        sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        durationSeconds = Get-WaveDurationSeconds $target
      }
    }
  }
  $manifestPath = Join-Path $output 'audio-manifest.json'
  if (Test-Path -LiteralPath $manifestPath) { throw "Refusing to overwrite $manifestPath" }
  [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
  Write-Output "Generated $($manifest.Count) WAV assets in $output using $($speaker.Voice.Name)."
} finally {
  $speaker.Dispose()
}
