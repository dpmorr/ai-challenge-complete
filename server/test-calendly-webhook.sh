#!/bin/bash

# Test Calendly Webhook Integration
# This script simulates a Calendly webhook being sent to our API

API_URL="http://localhost:8999"
EMPLOYEE_EMAIL="alice.johnson@acme.corp"

echo "🧪 Testing Calendly Webhook Integration"
echo "========================================"
echo ""

# Test 1: Send webhook for meeting booked
echo "📅 Test 1: Simulating 'invitee.created' webhook..."
curl -X POST "${API_URL}/api/webhooks/calendly" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"invitee.created\",
    \"payload\": {
      \"email\": \"${EMPLOYEE_EMAIL}\",
      \"name\": \"John Client\",
      \"event_start_time\": \"$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%S.000Z)\",
      \"event_end_time\": \"$(date -u -d '+1 day +30 minutes' +%Y-%m-%dT%H:%M:%S.000Z)\",
      \"cancel_url\": \"https://calendly.com/cancellations/test123\",
      \"reschedule_url\": \"https://calendly.com/reschedulings/test123\"
    }
  }"

echo -e "\n\n"

# Test 2: Send webhook for meeting canceled
echo "📅 Test 2: Simulating 'invitee.canceled' webhook..."
curl -X POST "${API_URL}/api/webhooks/calendly" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"invitee.canceled\",
    \"payload\": {
      \"email\": \"${EMPLOYEE_EMAIL}\",
      \"name\": \"John Client\",
      \"event_start_time\": \"$(date -u -d '+2 days' +%Y-%m-%dT%H:%M:%S.000Z)\",
      \"event_end_time\": \"$(date -u -d '+2 days +30 minutes' +%Y-%m-%dT%H:%M:%S.000Z)\",
      \"cancel_url\": \"https://calendly.com/cancellations/test456\",
      \"reschedule_url\": \"https://calendly.com/reschedulings/test456\"
    }
  }"

echo -e "\n\n"
echo "✅ Webhook tests completed!"
echo ""
echo "To view the updated employee calendar, visit:"
echo "${API_URL}/api/employees?email=${EMPLOYEE_EMAIL}"
