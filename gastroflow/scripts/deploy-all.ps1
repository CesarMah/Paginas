# deploy-all.ps1 — Despliega GastroFlow completo en AWS Free Tier
# Uso: .\scripts\deploy-all.ps1

# Configura tus credenciales en variables de entorno antes de ejecutar:
# $env:AWS_ACCESS_KEY_ID     = "TU_KEY"
# $env:AWS_SECRET_ACCESS_KEY = "TU_SECRET"
$env:AWS_DEFAULT_REGION    = "us-east-1"
$env:CDK_DEFAULT_ACCOUNT   = "978344289403"
$env:CDK_DEFAULT_REGION    = "us-east-1"
$env:STAGE                 = "dev"

$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host " GastroFlow — Deploy Automático" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# --- STEP 1: CDK Deploy ---
Write-Host "🚀 [1/5] Desplegando stacks CDK..." -ForegroundColor Yellow
Set-Location "$ROOT\infra"
npx cdk deploy --all --context stage=dev --require-approval never --outputs-file "$ROOT\scripts\cdk-outputs.json"
if ($LASTEXITCODE -ne 0) { Write-Host "❌ CDK deploy falló" -ForegroundColor Red; exit 1 }
Write-Host "✅ CDK deploy completado`n" -ForegroundColor Green

# --- STEP 2: Leer outputs ---
Write-Host "📋 [2/5] Leyendo outputs..." -ForegroundColor Yellow
$outputs = Get-Content "$ROOT\scripts\cdk-outputs.json" | ConvertFrom-Json

$DB_HOST     = $outputs.'GastroFlow-dev-Database'.DbEndpoint
$USER_POOL   = $outputs.'GastroFlow-dev-Auth'.UserPoolId
$CLIENT_ID   = $outputs.'GastroFlow-dev-Auth'.UserPoolClientId
$API_URL     = $outputs.'GastroFlow-dev-Api'.HttpApiUrl
$WS_URL      = $outputs.'GastroFlow-dev-Api'.WsApiUrl
$CF_DOMAIN   = $outputs.'GastroFlow-dev-Storage'.DistributionDomain
$MEDIA_BKT   = $outputs.'GastroFlow-dev-Storage'.MediaBucketName

Write-Host "  DB Host:     $DB_HOST"
Write-Host "  User Pool:   $USER_POOL"
Write-Host "  API URL:     $API_URL"
Write-Host "  CloudFront:  https://$CF_DOMAIN`n"

$env:DB_HOST   = $DB_HOST
$env:USER_POOL_ID = $USER_POOL

# --- STEP 3: Migraciones ---
Write-Host "🗄️  [3/5] Ejecutando migraciones SQL..." -ForegroundColor Yellow
Set-Location $ROOT
npx ts-node scripts/migrate.ts
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Migraciones fallaron" -ForegroundColor Red; exit 1 }
Write-Host "✅ Migraciones completadas`n" -ForegroundColor Green

# --- STEP 4: Seed (tenant + usuario admin) ---
Write-Host "🌱 [4/5] Creando tenant Calico y usuario admin..." -ForegroundColor Yellow
npx ts-node scripts/seed.ts
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Seed falló" -ForegroundColor Red; exit 1 }
Write-Host "✅ Seed completado`n" -ForegroundColor Green

# --- STEP 5: Build y deploy Frontend ---
Write-Host "🏗️  [5/5] Build del frontend..." -ForegroundColor Yellow
$env:VITE_API_URL                = $API_URL.TrimEnd('/')
$env:VITE_WS_URL                 = $WS_URL
$env:VITE_COGNITO_USER_POOL_ID   = $USER_POOL
$env:VITE_COGNITO_CLIENT_ID      = $CLIENT_ID
$env:VITE_COGNITO_REGION         = "us-east-1"

Set-Location "$ROOT\frontend"
pnpm build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Build falló" -ForegroundColor Red; exit 1 }

Write-Host "  Subiendo a S3..." -ForegroundColor Yellow
aws s3 sync dist s3://gastroflow-frontend-dev --delete --region us-east-1

Write-Host "  Invalidando CloudFront..." -ForegroundColor Yellow
$DIST_ID = aws cloudfront list-distributions `
  --query "DistributionList.Items[?Origins.Items[0].DomainName=='gastroflow-frontend-dev.s3.amazonaws.com'].Id" `
  --output text
if ($DIST_ID) {
  aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" | Out-Null
}

# --- Resumen final ---
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host " 🎉 GastroFlow desplegado con éxito!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🌐 URL:       https://$CF_DOMAIN" -ForegroundColor White
Write-Host "  📧 Email:     cessarmah@mirestaurante.mx" -ForegroundColor White
Write-Host "  🔑 Password:  Kali-1234." -ForegroundColor White
Write-Host ""
Write-Host "  API URL:  $API_URL" -ForegroundColor Gray
Write-Host "  WS URL:   $WS_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Rota las credenciales AWS en IAM después de este deploy." -ForegroundColor Yellow
