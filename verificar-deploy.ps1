# Verificar progresso do deploy no Render, direto do terminal.
# Chamado automaticamente pelo PUBLICAR_GITHUB.bat apos um push bem-sucedido.
# Se a API key ou os IDs de servico nao estiverem configurados, este script
# instrui como configurar (uma unica vez) e nao interrompe o fluxo de publicacao.

param(
    [string]$CommitSha = ""
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $PSScriptRoot "render-config.json"

function Get-RenderApiKey {
    $key = [Environment]::GetEnvironmentVariable("RENDER_API_KEY", "User")
    if ($key) { return $key }

    Write-Host ""
    Write-Host "Chave da API do Render ainda nao configurada nesta maquina."
    Write-Host "Gere uma em: https://dashboard.render.com/u/settings#api-keys"
    Write-Host "(Pressione Enter sem digitar nada para pular o acompanhamento agora.)"
    $inputKey = Read-Host "Cole a API key do Render"
    if ([string]::IsNullOrWhiteSpace($inputKey)) { return $null }

    [Environment]::SetEnvironmentVariable("RENDER_API_KEY", $inputKey.Trim(), "User")
    Write-Host "Chave salva para as proximas vezes (variavel de ambiente do Windows)."
    return $inputKey.Trim()
}

function Get-ServiceConfig {
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
            if ($config.apiServiceId -and $config.portalServiceId) {
                return $config
            }
        } catch {
            # config corrompido; recria abaixo
        }
    }

    Write-Host ""
    Write-Host "IDs dos servicos no Render ainda nao configurados."
    Write-Host "No painel do Render, abra cada servico e copie o ID da URL (comeca com 'srv-')."
    $apiId = Read-Host "ID do servico da API (odonto-excellence-api)"
    $portalId = Read-Host "ID do servico do Portal (odonto-excellence-portal)"
    if ([string]::IsNullOrWhiteSpace($apiId) -or [string]::IsNullOrWhiteSpace($portalId)) {
        return $null
    }

    $config = [PSCustomObject]@{
        apiServiceId    = $apiId.Trim()
        portalServiceId = $portalId.Trim()
    }
    $config | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8
    Write-Host "IDs salvos em render-config.json (nao vai para o GitHub)."
    return $config
}

function Get-StatusLabel($status) {
    switch ($status) {
        "created"                  { return "na fila" }
        "build_in_progress"        { return "construindo (build)" }
        "pre_deploy_in_progress"   { return "preparando" }
        "update_in_progress"       { return "publicando" }
        "live"                     { return "no ar" }
        "deactivated"              { return "desativado" }
        "build_failed"             { return "FALHOU no build" }
        "update_failed"            { return "FALHOU ao publicar" }
        "pre_deploy_failed"        { return "FALHOU na preparacao" }
        "canceled"                 { return "cancelado" }
        default                    { return $status }
    }
}

function Test-Terminal($status) {
    return $status -in @("live", "deactivated", "build_failed", "update_failed", "pre_deploy_failed", "canceled")
}

function Test-Failure($status) {
    return $status -in @("build_failed", "update_failed", "pre_deploy_failed", "canceled")
}

function Watch-Deploy {
    param(
        [string]$Label,
        [string]$ServiceId,
        [string]$ApiKey,
        [string]$ExpectedCommit
    )

    $headers = @{ Authorization = "Bearer $ApiKey" }
    $uri = "https://api.render.com/v1/services/$ServiceId/deploys?limit=5"
    $maxAttempts = 60
    $waitedForMatch = $false

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -TimeoutSec 15
        } catch {
            Write-Host "  [$Label] nao foi possivel consultar o Render agora (tentando de novo)..."
            Start-Sleep -Seconds 8
            continue
        }

        if (-not $response -or @($response).Count -eq 0) {
            Write-Host "  [$Label] nenhum deploy encontrado ainda..."
            Start-Sleep -Seconds 8
            continue
        }

        $deploy = $null
        if ($ExpectedCommit) {
            $deploy = $response | Where-Object {
                $_.deploy.commit.id -and $_.deploy.commit.id.StartsWith($ExpectedCommit.Substring(0, [Math]::Min(7, $ExpectedCommit.Length)))
            } | Select-Object -First 1
        }
        if (-not $deploy) {
            $deploy = $response | Select-Object -First 1
            if ($ExpectedCommit -and -not $waitedForMatch -and $attempt -lt 5) {
                # Da alguns segundos para o Render registrar o deploy do commit novo
                # antes de aceitar mostrar o status de um deploy anterior.
                $waitedForMatch = $true
                Start-Sleep -Seconds 5
                continue
            }
        }

        $status = $deploy.deploy.status
        if (-not $status) { $status = $deploy.status }
        $label = Get-StatusLabel $status

        Write-Host "  [$Label] $label"

        if (Test-Terminal $status) {
            if (Test-Failure $status) {
                Write-Host "  [$Label] ATENCAO: o deploy nao foi concluido com sucesso." -ForegroundColor Red
                return $false
            }
            Write-Host "  [$Label] Concluido." -ForegroundColor Green
            return $true
        }

        Start-Sleep -Seconds 8
    }

    Write-Host "  [$Label] tempo de espera esgotado. Confira manualmente no painel do Render." -ForegroundColor Yellow
    return $true
}

$apiKey = Get-RenderApiKey
if (-not $apiKey) {
    Write-Host ""
    Write-Host "Acompanhamento automatico pulado. Abrindo o site normalmente."
    exit 0
}

$config = Get-ServiceConfig
if (-not $config) {
    Write-Host ""
    Write-Host "Acompanhamento automatico pulado. Abrindo o site normalmente."
    exit 0
}

Write-Host ""
Write-Host "Acompanhando o deploy no Render (isso pode levar alguns minutos)..."
Write-Host ""

$apiOk = Watch-Deploy -Label "API" -ServiceId $config.apiServiceId -ApiKey $apiKey -ExpectedCommit $CommitSha
$portalOk = Watch-Deploy -Label "Portal" -ServiceId $config.portalServiceId -ApiKey $apiKey -ExpectedCommit $CommitSha

Write-Host ""
if ($apiOk -and $portalOk) {
    Write-Host "Deploy concluido nos dois servicos." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Pelo menos um servico teve problema no deploy. Confira os logs no painel do Render." -ForegroundColor Red
    exit 1
}
