Add-Type -AssemblyName System.Drawing

$sizes = @(192, 512)
$root = Split-Path -Parent $PSScriptRoot

foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(8, 9, 10))
  $fontSize = [int]($s / 3.5)
  $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold)
  $brush = [System.Drawing.Brushes]::White
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = 'Center'
  $format.LineAlignment = 'Center'
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.DrawString('P', $font, $brush, ($s / 2), ($s / 2), $format)
  $out = Join-Path $root "public\pwa-$s.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $font.Dispose()
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Wrote $out"
}
