Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speaker.SelectVoice('Microsoft Zira Desktop')
  $speaker.Rate = -2
  $draft = Get-Content -LiteralPath 'assets/expression-unit01-draft-lessons.json' -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($lesson in $draft.lessons) {
    for ($i=0; $i -lt $lesson.steps.Count; $i++) {
      if ($lesson.steps[$i].english) {
        $target = Join-Path (Get-Location) ('assets/expression-draft-' + $lesson.id + '-' + $i + '.wav')
        if (Test-Path -LiteralPath $target) { throw "Refusing to overwrite $target" }
        $speaker.SetOutputToWaveFile($target)
        $speaker.Speak($lesson.steps[$i].english)
        $speaker.SetOutputToNull()
      }
    }
  }
} finally { $speaker.Dispose() }
