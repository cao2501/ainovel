$models = @('qwen3.8-flash', 'glm-5.3-flash', 'minimax-m3-free')

foreach ($m in $models) {
    Write-Host "`n=== Testing Model: $m ==="
    $body = @{
        model = $m
        messages = @(
            @{ role = 'user'; content = 'Xin chào, viết 1 câu mở đầu truyện khoa huyễn.' }
        )
        stream = $false
    } | ConvertTo-Json

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $res = Invoke-RestMethod -Uri 'https://kiraai.vn/api/v1/chat/completions' -Method POST -Headers @{
            'Content-Type' = 'application/json'
            'Authorization' = 'Bearer kira_5ce16c4ec25b8613d9aedeb2eff2f578'
        } -Body $body -TimeoutSec 30
        $sw.Stop()
        Write-Host "Success in $($sw.ElapsedMilliseconds)ms"
        Write-Host "Has reasoning: $([bool]$res.choices[0].message.reasoning_content)"
        Write-Host "Content: $($res.choices[0].message.content)"
    } catch {
        $sw.Stop()
        Write-Host "Failed in $($sw.ElapsedMilliseconds)ms: $($_.Exception.Message)"
    }
}
