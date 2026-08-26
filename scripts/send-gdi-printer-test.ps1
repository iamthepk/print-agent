param(
  [Parameter(Mandatory=$true)]
  [string]$PrinterName,

  [string]$PaperName = "",

  [string]$Text = "KITCHEN TEST`r`nPrinter: {printer}`r`nTime: {time}`r`nPayload: direct driver test",

  [ValidateRange(1, 10)]
  [int]$Copies = 1
)

Add-Type -AssemblyName System.Drawing

function Apply-CurrentPrintConfiguration {
  param(
    [Parameter(Mandatory=$true)]$Doc,
    [Parameter(Mandatory=$true)][string]$PrinterName
  )

  try {
    $configuration = Get-PrintConfiguration -PrinterName $PrinterName -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($configuration.PrintTicketXML)) {
      return
    }

    $ticket = [xml]$configuration.PrintTicketXML
    $namespaces = New-Object System.Xml.XmlNamespaceManager($ticket.NameTable)
    $namespaces.AddNamespace("psf", "http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework")
    $namespaces.AddNamespace("psk", "http://schemas.microsoft.com/windows/2003/08/printschemakeywords")

    $orientationNode = $ticket.SelectSingleNode("//psf:Feature[@name='psk:PageOrientation']/psf:Option", $namespaces)
    if ($null -ne $orientationNode) {
      $Doc.DefaultPageSettings.Landscape = $orientationNode.GetAttribute("name") -eq "psk:Landscape"
    }

    $mediaNode = $ticket.SelectSingleNode("//psf:Feature[@name='psk:PageMediaSize']/psf:Option", $namespaces)
    if ($null -eq $mediaNode) {
      return
    }

    $widthNode = $mediaNode.SelectSingleNode("psf:ScoredProperty[@name='psk:MediaSizeWidth']/psf:Value", $namespaces)
    $heightNode = $mediaNode.SelectSingleNode("psf:ScoredProperty[@name='psk:MediaSizeHeight']/psf:Value", $namespaces)
    if ($null -eq $widthNode -or $null -eq $heightNode) {
      return
    }

    $targetWidth = [int][Math]::Round([double]$widthNode.InnerText / 254.0)
    $targetHeight = [int][Math]::Round([double]$heightNode.InnerText / 254.0)

    foreach ($paperSize in $Doc.PrinterSettings.PaperSizes) {
      $widthMatches = [Math]::Abs($paperSize.Width - $targetWidth) -le 2
      $heightMatches = [Math]::Abs($paperSize.Height - $targetHeight) -le 2
      if ($widthMatches -and $heightMatches) {
        $Doc.DefaultPageSettings.PaperSize = $paperSize
        break
      }
    }
  } catch {
  }
}

function Apply-RequestedPaperName {
  param(
    [Parameter(Mandatory=$true)]$Doc,
    [AllowEmptyString()][string]$PaperName
  )

  if ([string]::IsNullOrWhiteSpace($PaperName)) {
    return
  }

  foreach ($paperSize in $Doc.PrinterSettings.PaperSizes) {
    if ($paperSize.PaperName -eq $PaperName) {
      $Doc.DefaultPageSettings.PaperSize = $paperSize
      return
    }
  }

  throw "Printer '$($Doc.PrinterSettings.PrinterName)' does not support paper size '$PaperName'."
}

$resolvedText = $Text.Replace("{printer}", $PrinterName).Replace("{time}", (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))

$printed = 0
$selectedPaper = $null
$selectedLandscape = $false

for ($copy = 0; $copy -lt $Copies; $copy++) {
  $doc = New-Object System.Drawing.Printing.PrintDocument
  $font = $null
  $format = $null
  $handler = $null

  try {
    $doc.DocumentName = "Print Agent driver test"
    $doc.PrinterSettings.PrinterName = $PrinterName

    if (-not $doc.PrinterSettings.IsValid) {
      throw "Printer '$PrinterName' is not valid or is unavailable."
    }

    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    $doc.OriginAtMargins = $true
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(2, 2, 2, 2)
    Apply-CurrentPrintConfiguration -Doc $doc -PrinterName $PrinterName
    Apply-RequestedPaperName -Doc $doc -PaperName $PaperName

    $paper = $doc.DefaultPageSettings.PaperSize
    $selectedPaper = $paper.PaperName
    $selectedLandscape = $doc.DefaultPageSettings.Landscape
    $fontSize = 10.0
    if ([Math]::Min($paper.Width, $paper.Height) -le 160) {
      $fontSize = 7.5
    }

    $font = New-Object System.Drawing.Font -ArgumentList "Arial", ([single]$fontSize), ([System.Drawing.FontStyle]::Regular)
    $format = New-Object System.Drawing.StringFormat
    $format.Trimming = [System.Drawing.StringTrimming]::Word
    $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit

    $handler = [System.Drawing.Printing.PrintPageEventHandler]{
      param($sender, $event)

      $bounds = $event.MarginBounds
      if ($bounds.Width -lt 50 -or $bounds.Height -lt 50) {
        $bounds = $event.PageBounds
      }

      $layout = New-Object System.Drawing.RectangleF -ArgumentList ([single]$bounds.Left), ([single]$bounds.Top), ([single]$bounds.Width), ([single]$bounds.Height)

      $event.Graphics.DrawString($resolvedText, $font, [System.Drawing.Brushes]::Black, $layout, $format)
      $event.HasMorePages = $false
    }

    $doc.add_PrintPage($handler)
    $doc.Print()
    $printed += 1
  } finally {
    if ($null -ne $handler) {
      $doc.remove_PrintPage($handler)
    }

    if ($null -ne $format) {
      $format.Dispose()
    }

    if ($null -ne $font) {
      $font.Dispose()
    }

    $doc.Dispose()
  }
}

Write-Host "Printed $printed driver document(s) to '$PrinterName' using paper '$selectedPaper' landscape=$selectedLandscape."
