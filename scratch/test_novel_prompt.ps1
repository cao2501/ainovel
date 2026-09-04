$body = @{
    model = 'qwen3.8-flash'
    messages = @(
        @{ role = 'system'; content = 'Bạn là nhà văn tiểu thuyết. Hãy viết phân cảnh 300 từ.' }
        @{ role = 'user'; content = 'Trưa hè mất điện và cục pin hạt nhân rơi trúng mái tôn.' }
    )
    stream = $true
    max_tokens = 2048
} | ConvertTo-Json

$request = [System.Net.HttpWebRequest]::Create("https://kiraai.vn/api/v1/chat/completions")
$request.Method = "POST"
$request.ContentType = "application/json"
$request.Headers.Add("Authorization", "Bearer kira_5ce16c4ec25b8613d9aedeb2eff2f578")

$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$request.ContentLength = $bytes.Length
$stream = $request.GetRequestStream()
$stream.Write($bytes, 0, $bytes.Length)
$stream.Close()

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = $request.GetResponse()
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $contentCount = 0
    $reasoningCount = 0
    while (-not $reader.EndOfStream) {
        $line = $reader.ReadLine()
        if ($line -and $line.StartsWith("data: ") -and -not $line.Contains("[DONE]")) {
            $json = $line.Substring(6) | ConvertFrom-Json
            $delta = $json.choices[0].delta
            if ($delta.reasoning_content) {
                $reasoningCount++
            }
            if ($delta.content) {
                $contentCount++
            }
        }
    }
    $sw.Stop()
    Write-Host "Completed in $($sw.ElapsedMilliseconds) ms"
    Write-Host "Reasoning chunks: $reasoningCount, Content chunks: $contentCount"
} catch {
    Write-Host "Error in $($sw.ElapsedMilliseconds) ms: $($_.Exception.Message)"
}
