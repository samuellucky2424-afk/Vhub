# 🔍 Auto-Cancel Debugging Guide

## Issue: Order not auto-canceling after 80 seconds

Here's how to debug why the auto-cancel isn't working for your specific order:

## 🚨 Quick Debug Steps

### 1. Check Order Status
```sql
-- Run this in your Supabase SQL Editor
SELECT 
    id, 
    status, 
    payment_status, 
    request_id, 
    user_id, 
    created_at,
    metadata
FROM orders 
WHERE id = 'YOUR_ORDER_ID';
```

### 2. Check if Fast Polling Ran
Look for these metadata fields:
- `polling_attempts`: Number of polling attempts
- `timeout_duration`: How long it ran before timeout
- `smspool_status`: Final SMSPool status
- `timeout_reason`: Should be '80_second_limit_reached'

### 3. Check Supabase Logs
Go to your Supabase project → Edge Functions → smspool-service → Logs
Look for these log messages:
- `[OTP_FAST_POLL] Starting fast polling`
- `[OTP] TIMEOUT DETECTED`
- `[OTP] Calling cancel API`
- `[OTP] Order status updated successfully`
- `[OTP] Auto-refund processed successfully`

## 🔧 Common Issues & Solutions

### Issue 1: Fast Polling Never Started
**Symptoms**: No `[OTP_FAST_POLL]` logs, no polling attempts in metadata

**Causes**:
- Order was created before the fast polling was implemented
- Fast polling function crashed silently
- Background process didn't start

**Solution**:
```bash
# Manually trigger fast polling
curl -X POST https://your-project.supabase.co/functions/v1/smspool-service \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{"action": "fast_poll_otp", "order_id": "YOUR_ORDER_ID"}'
```

### Issue 2: Fast Polling Started but Didn't Timeout
**Symptoms**: Polling attempts in metadata, but no timeout logs

**Causes**:
- Order found OTP before 80s (successful)
- Order was refunded by SMSPool before 80s
- Fast polling crashed during execution

**Solution**:
Check the SMSPool order status:
```bash
# Check SMSPool order status
curl "https://api.smspool.net/sms/check?key=YOUR_SMSPOOL_API_KEY&orderid=SMSPool_ORDER_ID"
```

### Issue 3: Timeout Detected but Cancel Failed
**Symptoms**: Timeout logs but no cancel/refund

**Causes**:
- SMSPool cancel API failed
- Database update failed
- Refund RPC failed

**Solution**:
Check the detailed error logs in Supabase Edge Function logs.

## 🧪 Manual Testing

### Test with Debug Script
```bash
# Run the debug script
node debug_order.js YOUR_ORDER_ID
```

Remember to replace:
- `YOUR_ORDER_ID` with the actual order ID
- `your-project.supabase.co` with your Supabase URL
- `YOUR_SUPABASE_ANON_KEY` with your Supabase anon key
- `YOUR_SMSPOOL_API_KEY` with your SMSPool API key

### Test SMSPool API
```bash
# Test SMSPool cancel endpoint
node test_smspool_cancel.js
```

## 📊 What to Look For

### ✅ Working Auto-Cancel Should Show:
1. `[OTP_FAST_POLL] Starting fast polling for order XYZ`
2. Multiple `[OTP_FAST_POLL] Attempt X (Ys elapsed)` logs
3. `[OTP] TIMEOUT DETECTED - cancelling order after 80s`
4. `[OTP] Calling cancel API: https://api.smspool.net/sms/cancel...`
5. `[OTP] Cancel API response (200): {...}`
6. `[OTP] Order status updated successfully`
7. `[OTP] Auto-refund processed successfully`

### ❌ Broken Auto-Cancel Might Show:
- No fast polling logs at all
- Fast polling logs but no timeout detection
- Timeout detection but cancel API errors
- Cancel success but database update failures
- Database success but refund failures

## 🛠️ Immediate Actions

### 1. Check Your Specific Order
Run this SQL query to see what happened:
```sql
SELECT 
    id,
    status,
    payment_status,
    request_id,
    created_at,
    metadata->>'polling_attempts' as polling_attempts,
    metadata->>'timeout_duration' as timeout_duration,
    metadata->>'smspool_status' as smspool_status,
    metadata->>'timeout_reason' as timeout_reason
FROM orders 
WHERE id = 'YOUR_ORDER_ID';
```

### 2. Manually Cancel if Needed
If the order is still pending and should be cancelled:
```bash
# Cancel the SMSPool order
curl "https://api.smspool.net/sms/cancel?key=YOUR_SMSPOOL_API_KEY&orderid=SMSPool_ORDER_ID"

# Update database status
curl -X PATCH https://your-project.supabase.co/rest/v1/orders?id=eq.YOUR_ORDER_ID \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_SUPABASE_SERVICE_KEY" \
  -d '{"status": "failed", "metadata": {"smspool_status": "manually_cancelled"}}'

# Process refund (if needed)
curl -X POST https://your-project.supabase.co/rest/v1/rpc/refund_wallet \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_SUPABASE_SERVICE_KEY" \
  -d '{
    "p_user_id": "USER_ID",
    "p_order_id": "YOUR_ORDER_ID", 
    "p_amount_kobo": 0,
    "p_reason": "Manual refund - auto-cancel failed"
  }'
```

## 📞 Next Steps

1. **Check your order** using the SQL query above
2. **Look at Supabase logs** for the specific order ID
3. **Run the debug script** to get a complete picture
4. **Manually trigger fast polling** if it never started
5. **Manually cancel and refund** if needed

The enhanced logging I added will help identify exactly where the process is failing for future orders.
