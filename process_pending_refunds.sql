-- =============================================================
-- STEP 1: Run apply_refund_fix.sql FIRST (in a separate query)
-- STEP 2: Then run THIS script to process refunds for the 5 orders
--         that were marked 'refunded' but never got money back
-- =============================================================

-- Temporarily reset the 5 orders to 'pending' so process_order_refund can run
UPDATE public.orders 
SET payment_status = 'pending'
WHERE id IN (
    '55e47f7e-d2d9-4a52-8052-d00869c9d381',
    '2f96c610-1379-4e0a-8555-68e738c87ab7',
    '1acbdd05-211d-4b83-b182-cc033cbbcec7',
    'ed2f6ca9-dcc5-4432-8ef1-954093dfc2a8',
    '68a3aaca-848a-464b-bf20-0631b1f88418'
)
AND payment_status = 'refunded';

-- Now process each refund (these will use price_usd for the amount)
SELECT process_order_refund('55e47f7e-d2d9-4a52-8052-d00869c9d381'::uuid) AS order_1;
SELECT process_order_refund('2f96c610-1379-4e0a-8555-68e738c87ab7'::uuid) AS order_2;
SELECT process_order_refund('1acbdd05-211d-4b83-b182-cc033cbbcec7'::uuid) AS order_3;
SELECT process_order_refund('ed2f6ca9-dcc5-4432-8ef1-954093dfc2a8'::uuid) AS order_4;
SELECT process_order_refund('68a3aaca-848a-464b-bf20-0631b1f88418'::uuid) AS order_5;
