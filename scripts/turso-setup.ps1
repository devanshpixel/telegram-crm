param(
  [Parameter(Mandatory)]
  [string]$ApiToken,
  [string]$DbName = "telegram-crm"
)

$Organization = "personal"
$ApiBase = "https://api.turso.tech/v1"

$Headers = @{
  Authorization = "Bearer $ApiToken"
  "Content-Type" = "application/json"
}

Write-Host "=== Step 1: Creating database '$DbName' ===" -ForegroundColor Cyan
$body = @{ name = $DbName; group = "default" } | ConvertTo-Json
try {
  $create = Invoke-RestMethod -Uri "$ApiBase/organizations/$Organization/databases" -Method Post -Headers $Headers -Body $body
  $dbHostname = $create.database.hostname
  Write-Host "  Hostname: $dbHostname" -ForegroundColor Green
} catch {
  Write-Host "  FAILED: $_" -ForegroundColor Red
  exit 1
}

Write-Host "=== Step 2: Creating auth token ===" -ForegroundColor Cyan
try {
  $tokenBody = @{ permission = "full-access" } | ConvertTo-Json
  $tokenResult = Invoke-RestMethod -Uri "$ApiBase/organizations/$Organization/databases/$DbName/auth/tokens" -Method Post -Headers $Headers -Body $tokenBody
  $DbToken = $tokenResult.jwt
  Write-Host "  Token created" -ForegroundColor Green
} catch {
  Write-Host "  FAILED: $_" -ForegroundColor Red
  exit 1
}

Write-Host "=== Database created successfully ===" -ForegroundColor Green
Write-Host ""
Write-Host "=== Environment variables to set ===" -ForegroundColor Yellow
$DbUrl = "libsql://$dbHostname"
Write-Host "TURSO_DB_URL=$DbUrl" -ForegroundColor White
Write-Host "TURSO_DB_TOKEN=$DbToken" -ForegroundColor White
Write-Host ""
Write-Host "=== Step 3: Set in .env (local) ===" -ForegroundColor Cyan
Write-Host "Add these two lines to .env.local:" -ForegroundColor White
Write-Host "TURSO_DB_URL=$DbUrl"
Write-Host "TURSO_DB_TOKEN=$DbToken"
Write-Host ""

Write-Host "=== Step 4: Migrate data ===" -ForegroundColor Cyan
Write-Host "Run:   npx tsx scripts/migrate-to-turso.ts"
Write-Host ""

Write-Host "=== Step 5: Set on Vercel ===" -ForegroundColor Cyan
Write-Host "vercel env add TURSO_DB_URL production"
Write-Host "vercel env add TURSO_DB_TOKEN production"
Write-Host "vercel env add OFFER_PRICE production"
Write-Host "vercel env add OPENROUTER_API_KEY production"
Write-Host "vercel env add RAZORPAY_KEY_ID production"
Write-Host "vercel env add RAZORPAY_KEY_SECRET production"
Write-Host "vercel env add RAZORPAY_WEBHOOK_SECRET production"
Write-Host "vercel env add TELEGRAM_API_ID production"
Write-Host "vercel env add TELEGRAM_API_HASH production"
Write-Host "vercel env add CRM_API_KEY production"
Write-Host "vercel env add APP_URL production"
