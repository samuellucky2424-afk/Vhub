# 🚨 Countdown Deployment Troubleshooting

## Issue: Countdown not showing on website

## 🔍 Quick Debug Steps

### 1. **Check Edge Function Deployment**
```bash
# Check if your changes are deployed
supabase functions list
```

**Expected Output**: Should show `smspool-service` in the list

### 2. **Check Edge Function Logs**
```bash
# View real-time logs
supabase functions logs smspool-service --limit 50
```

**Look for these logs:**
- `[COUNTDOWN_API] Getting countdown for order...`
- `[COUNTDOWN_API] Countdown data for order...`
- `[COUNTDOWN_API] active=true, remaining=75s`

### 3. **Test API Endpoint Directly**
```bash
# Test the new endpoint
curl -X POST https://your-project.supabase.co/functions/v1/smspool-service \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "action": "get_order_countdown",
    "order_id": "YOUR_TEST_ORDER_ID"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "order_id": "YOUR_TEST_ORDER_ID",
  "countdown": {
    "active": true,
    "time_remaining_seconds": 75,
    "percentage": 6
  }
}
```

### 4. **Check Frontend Integration**
```javascript
// Test in browser console
fetch('/supabase/functions/v1/smspool-service', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({
        action: 'get_order_countdown',
        order_id: 'YOUR_ORDER_ID'
    })
})
.then(response => response.json())
.then(data => console.log('Countdown API Response:', data))
.catch(error => console.error('Countdown API Error:', error));
```

## 🔧 Common Issues & Solutions

### Issue 1: **Edge Function Not Deployed**
**Symptoms:**
- 404 errors when calling API
- Old code still running
- No `[COUNTDOWN_API]` logs

**Solution:**
```bash
# Deploy the updated function
supabase functions deploy smspool-service
```

### Issue 2: **CORS Problems**
**Symptoms:**
- CORS errors in browser console
- Network errors when calling API

**Solution:**
The CORS headers are already included, but check:
```javascript
// Make sure you're using the correct Supabase URL
const supabaseUrl = 'https://your-project-id.supabase.co';
```

### Issue 3: **Authorization Problems**
**Symptoms:**
- 401 Unauthorized errors
- "Invalid JWT" errors

**Solution:**
```javascript
// Use the ANON key (not service role key)
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // From Supabase Settings > API

// NOT the service role key
// const supabaseServiceKey = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // WRONG
```

### Issue 4: **Order ID Problems**
**Symptoms:**
- "Order not found" errors
- Empty countdown data

**Solution:**
```sql
-- Check if order exists in database
SELECT id, status, created_at, metadata 
FROM orders 
WHERE id = 'YOUR_ORDER_ID';
```

### Issue 5: **Frontend URL Problems**
**Symptoms:**
- countdown-website.html not found
- 404 errors

**Solution:**
```html
<!-- Make sure the HTML file is in your public folder -->
<!-- And accessible via: https://yoursite.com/countdown.html -->
```

## 🚀 Quick Fix Checklist

### ✅ **Backend Checklist**
- [ ] Edge Function deployed with latest code
- [ ] No TypeScript compilation errors
- [ ] CORS headers properly configured
- [ ] Environment variables set correctly
- [ ] Database connection working

### ✅ **Frontend Checklist**
- [ ] HTML file accessible via URL
- [ ] Supabase URL correct
- [ ] API key configured correctly
- [ ] Order ID passed correctly
- [ ] No JavaScript console errors

### ✅ **Integration Checklist**
- [ ] API endpoint responds correctly
- [ ] Frontend receives data
- [ ] Countdown displays correctly
- [ ] Real-time updates working
- [ ] Error handling functional

## 🧪 **Immediate Test**

### Test with Real Order ID
1. **Get a real order ID** from your database
2. **Test the API** directly with curl
3. **Test the frontend** in browser
4. **Check logs** for any errors

### Example Test Command
```bash
# Replace with your actual values
curl -X POST https://your-project.supabase.co/functions/v1/smspool-service \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "action": "get_order_countdown",
    "order_id": "abc-123-def-456"
  }'
```

## 📞 **If Still Not Working**

### 1. **Manual Deployment**
```bash
# Force redeploy
supabase functions delete smspool-service
supabase functions deploy smspool-service
```

### 2. **Check Function Code**
```bash
# Verify the deployed code
supabase functions get smspool-service
```

### 3. **Database Check**
```sql
-- Verify orders table structure
\d orders
-- Check recent orders
SELECT id, status, created_at, metadata 
FROM orders 
ORDER BY created_at DESC 
LIMIT 5;
```

### 4. **Environment Check**
```bash
# Verify environment variables
supabase secrets list
```

## 🎯 **Expected Result**

Once working, you should see:
1. **API Response**: Countdown data with active=true
2. **Frontend Display**: Real-time countdown timer
3. **Auto-refresh**: Updates every 2 seconds
4. **Color Changes**: Green → Orange → Red as time decreases
5. **OTP Display**: Code appears when detected

## 📞 **Need Help?**

If you're still stuck, provide:
1. **Error messages** from browser console
2. **API responses** from curl tests
3. **Edge Function logs** from Supabase
4. **Order ID** you're testing with

I can help you debug the specific issue once you share this information!
