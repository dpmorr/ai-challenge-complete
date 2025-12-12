# Test Calendly Webhook Integration (PowerShell)
# This script simulates a Calendly webhook being sent to our API

$API_URL = "http://localhost:8999"
$EMPLOYEE_EMAIL = "alice.johnson@acme.corp"

Write-Host "🧪 Testing Calendly Webhook Integration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Send webhook for meeting booked
Write-Host "📅 Test 1: Simulating 'invitee.created' webhook..." -ForegroundColor Yellow

$eventStart = (Get-Date).AddDays(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
$eventEnd = (Get-Date).AddDays(1).AddMinutes(30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")

$body1 = @{
    event = "invitee.created"
    payload = @{
        email = $EMPLOYEE_EMAIL
        name = "John Client"
        event_start_time = $eventStart
        event_end_time = $eventEnd
        cancel_url = "https://calendly.com/cancellations/test123"
        reschedule_url = "https://calendly.com/reschedulings/test123"
    }
} | ConvertTo-Json -Depth 3

try {
    $response1 = Invoke-RestMethod -Uri "$API_URL/api/webhooks/calendly" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body1

    Write-Host "✅ Response:" -ForegroundColor Green
    $response1 | ConvertTo-Json
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# Test 2: Send webhook for meeting canceled
Write-Host "📅 Test 2: Simulating 'invitee.canceled' webhook..." -ForegroundColor Yellow

$eventStart2 = (Get-Date).AddDays(2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
$eventEnd2 = (Get-Date).AddDays(2).AddMinutes(30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")

$body2 = @{
    event = "invitee.canceled"
    payload = @{
        email = $EMPLOYEE_EMAIL
        name = "John Client"
        event_start_time = $eventStart2
        event_end_time = $eventEnd2
        cancel_url = "https://calendly.com/cancellations/test456"
        reschedule_url = "https://calendly.com/reschedulings/test456"
    }
} | ConvertTo-Json -Depth 3

try {
    $response2 = Invoke-RestMethod -Uri "$API_URL/api/webhooks/calendly" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body2

    Write-Host "✅ Response:" -ForegroundColor Green
    $response2 | ConvertTo-Json
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host ""
Write-Host "✅ Webhook tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "To view the updated employee calendar, visit:" -ForegroundColor Cyan
Write-Host "$API_URL/api/employees?email=$EMPLOYEE_EMAIL"
