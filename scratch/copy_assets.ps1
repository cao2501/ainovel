$brain = "C:\Users\chica\.gemini\antigravity-ide\brain\e3a472d6-5758-4eb6-8a17-dbe57d85d455"
$dest = "d:\AntiGravity CODE FOLDER\Truyen\assets"

if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

Copy-Item (Join-Path $brain "aitory_logo_1788511744445.jpg") (Join-Path $dest "logo.jpg") -Force
Copy-Item (Join-Path $brain "aitory_hero_banner_1788511765943.jpg") (Join-Path $dest "hero-banner.jpg") -Force
Copy-Item (Join-Path $brain "novel_coin_icon_1788511789017.jpg") (Join-Path $dest "coin.jpg") -Force
Copy-Item (Join-Path $brain "agent_architect_icon_1788511811123.jpg") (Join-Path $dest "agent-architect.jpg") -Force
Copy-Item (Join-Path $brain "agent_writer_icon_1788511841694.jpg") (Join-Path $dest "agent-writer.jpg") -Force
Copy-Item (Join-Path $brain "agent_editor_icon_1788511876635.jpg") (Join-Path $dest "agent-editor.jpg") -Force
Copy-Item (Join-Path $brain "agent_arbiter_icon_1788511905619.jpg") (Join-Path $dest "agent-arbiter.jpg") -Force
Copy-Item (Join-Path $brain "agent_coordinator_icon_1788511933523.jpg") (Join-Path $dest "agent-coordinator.jpg") -Force

Get-ChildItem $dest | Select-Object Name, Length
