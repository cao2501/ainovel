$body = @{
    model = 'qwen3.8-flash'
    messages = @(
        @{ role = 'user'; content = 'Xin chào, trả lời ngắn gọn.' }
    )
    stream = $false
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri 'https://kiraai.vn/api/v1/chat/completions' -Method POST -Headers @{
        'Content-Type' = 'application/json'
        'Authorization' = 'Bearer kira_5ce16c4ec25b8613d9aedeb2eff2f578'
    } -Body $body -TimeoutSec 15
    Write-Host "SUCCESS:"
    $res | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Response body: $($reader.ReadToEnd())"
    }
}
