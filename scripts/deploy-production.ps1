param(
  [string]$EnvFile = ".env.local",
  [string]$VercelUrl = "https://testora-platform.vercel.app"
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string]$Path)
  $values = @{}
  if (!(Test-Path $Path)) {
    throw "Missing env file: $Path"
  }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (!$trimmed -or $trimmed.StartsWith("#")) { continue }
    $parts = $trimmed -split "=", 2
    if ($parts.Count -eq 2) {
      $values[$parts[0].Trim()] = $parts[1].Trim()
    }
  }

  return $values
}

function Require-Value {
  param(
    [hashtable]$Values,
    [string]$Name
  )
  if (!$Values.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Values[$Name])) {
    throw "Missing required value in .env.local: $Name"
  }
}

function Set-VercelEnv {
  param(
    [string]$Name,
    [string]$Value
  )
  vercel env rm $Name production --yes 2>$null | Out-Null
  $Value | vercel env add $Name production | Out-Null
  Write-Host "Set Vercel env: $Name"
}

$envValues = Read-DotEnv $EnvFile
$required = @(
  "MONGODB_URI",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
)

foreach ($name in $required) {
  Require-Value $envValues $name
}

if (!$envValues["MONGODB_URI"].StartsWith("mongodb+srv://")) {
  throw "MONGODB_URI must be a MongoDB Atlas SRV URI for production."
}

$vercelValues = @{
  "MONGODB_URI" = $envValues["MONGODB_URI"]
  "CLOUDINARY_CLOUD_NAME" = $envValues["CLOUDINARY_CLOUD_NAME"]
  "CLOUDINARY_API_KEY" = $envValues["CLOUDINARY_API_KEY"]
  "CLOUDINARY_API_SECRET" = $envValues["CLOUDINARY_API_SECRET"]
  "CLIENT_URL" = $VercelUrl
}

foreach ($entry in $vercelValues.GetEnumerator()) {
  Set-VercelEnv $entry.Key $entry.Value
}

Write-Host "Deploying Vercel production..."
vercel --prod --yes

Write-Host "Checking Vercel health..."
$health = Invoke-RestMethod "$VercelUrl/api/health"
$health | ConvertTo-Json -Compress

if ($envValues.ContainsKey("RENDER_API_KEY") -and ![string]::IsNullOrWhiteSpace($envValues["RENDER_API_KEY"])) {
  Write-Host "Checking Render API key..."
  $headers = @{
    Authorization = "Bearer $($envValues["RENDER_API_KEY"])"
    Accept = "application/json"
  }
  $owners = Invoke-RestMethod -Headers $headers -Uri "https://api.render.com/v1/owners" -Method Get
  Write-Host "Render API key valid. Owners visible: $(($owners | Measure-Object).Count)"
} else {
  Write-Host "RENDER_API_KEY not set; skipping Render API check."
}
