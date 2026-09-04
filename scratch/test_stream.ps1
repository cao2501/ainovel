$body = @{
    model = 'qwen3.8-flash'
    messages = @(
        @{ role = 'user'; content = 'Xin chào, viết 2 câu về vũ trụ.' }
    )
    stream = $true
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

try {
    $response = $request.GetResponse()
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $count = 0
    while (-not $reader.EndOfStream -and $count -lt 25) {
        $line = $reader.ReadLine()
        if ($line) {
            Write-Host $line
            $count++
        }
    }
} catch {
    Write-Host "Stream error: $($_.Exception.Message)"
}
