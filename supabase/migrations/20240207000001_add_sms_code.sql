alter table public.orders 
add column if not exists sms_code text;

-- Add a comment to explain usage
comment on column public.orders.sms_code is 'The received SMS verification code from SMSPool';
