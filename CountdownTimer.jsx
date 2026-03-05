import React, { useState, useEffect, useCallback } from 'react';
import { CircularProgress, Box, Typography, Button, Alert, Card, CardContent } from '@mui/material';
import { Refresh, Phone, AccessTime, CheckCircle, Error, Cancel } from '@mui/icons-material';

const CountdownTimer = ({ orderId, supabaseUrl, supabaseAnonKey }) => {
    const [countdown, setCountdown] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    // Load countdown data
    const loadCountdown = useCallback(async () => {
        if (!orderId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${supabaseUrl}/functions/v1/smspool-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`
                },
                body: JSON.stringify({
                    action: 'get_order_countdown',
                    order_id: orderId
                })
            });

            const data = await response.json();
            
            if (data.success) {
                setCountdown(data);
            } else {
                setError(data.message || 'Failed to load countdown data');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [orderId, supabaseUrl, supabaseAnonKey]);

    // Auto-refresh countdown
    useEffect(() => {
        loadCountdown();
        
        if (!orderId) return;

        const interval = setInterval(() => {
            if (countdown?.countdown?.active) {
                loadCountdown();
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [orderId, countdown?.countdown?.active, loadCountdown]);

    // Get status color
    const getStatusColor = () => {
        if (!countdown?.countdown) return '#grey';
        
        const { active, final_status, time_remaining_seconds } = countdown.countdown;
        
        if (!active) {
            switch (final_status) {
                case 'completed': return '#4CAF50';
                case 'refunded': return '#FF9800';
                case 'failed': return '#F44336';
                default: return '#grey';
            }
        }
        
        if (time_remaining_seconds <= 10) return '#F44336';
        if (time_remaining_seconds <= 30) return '#FF9800';
        return '#4CAF50';
    };

    // Get status message
    const getStatusMessage = () => {
        if (!countdown?.countdown) return 'Loading...';
        
        const { active, message, final_status, otp_code } = countdown.countdown;
        
        if (!active) {
            switch (final_status) {
                case 'completed': return 'OTP received successfully!';
                case 'refunded': return 'Order was refunded';
                case 'failed': return 'Order failed';
                default: return message || 'Order completed';
            }
        }
        
        return message || 'Waiting for OTP...';
    };

    // Get status icon
    const getStatusIcon = () => {
        if (!countdown?.countdown) return <Refresh />;
        
        const { active, final_status } = countdown.countdown;
        
        if (!active) {
            switch (final_status) {
                case 'completed': return <CheckCircle />;
                case 'refunded': return <Cancel />;
                case 'failed': return <Error />;
                default: return <Refresh />;
            }
        }
        
        return <AccessTime />;
    };

    if (!orderId) {
        return (
            <Alert severity="warning">
                No order ID provided. Please provide an order ID to view countdown.
            </Alert>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                {error}
            </Alert>
        );
    }

    return (
        <Box sx={{ maxWidth: 500, mx: 'auto', p: 2 }}>
            <Card>
                <CardContent>
                    {/* Header */}
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Typography variant="h5" gutterBottom>
                            OTP Verification
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            Order #{orderId} {countdown?.order_details?.phone_number && `- ${countdown.order_details.phone_number}`}
                        </Typography>
                    </Box>

                    {/* Countdown Display */}
                    {countdown?.countdown && (
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                            <CircularProgress
                                variant="determinate"
                                value={countdown.countdown.percentage || 0}
                                size={120}
                                sx={{ 
                                    color: getStatusColor(),
                                    mb: 2
                                }}
                            />
                            
                            <Typography variant="h4" sx={{ mt: 2 }}>
                                {countdown.countdown.time_remaining_seconds || 0}s
                            </Typography>
                            
                            <Typography variant="body2" color="textSecondary">
                                {getStatusMessage()}
                            </Typography>

                            {/* Progress Bar */}
                            <Box sx={{ width: '100%', mt: 2 }}>
                                <Box
                                    sx={{
                                        height: 8,
                                        borderRadius: 4,
                                        bgcolor: '#e0e0e0',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <Box
                                        sx={{
                                            height: '100%',
                                            borderRadius: 4,
                                            bgcolor: getStatusColor(),
                                            width: `${countdown.countdown.percentage || 0}%`,
                                            transition: 'width 1s ease-in-out'
                                        }}
                                    />
                                </Box>
                            </Box>

                            {/* OTP Code Display */}
                            {countdown.countdown.otp_code && (
                                <Box sx={{ 
                                    mt: 3, 
                                    p: 2, 
                                    bgcolor: '#E8F5E8',
                                    border: '2px dashed #2E7D32',
                                    borderRadius: 2,
                                    fontFamily: 'monospace'
                                }}>
                                    <Typography variant="h5" sx={{ 
                                        letterSpacing: 3, 
                                        color: '#2E7D32',
                                        fontWeight: 'bold',
                                        textAlign: 'center'
                                    }}>
                                        {countdown.countdown.otp_code}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Status Icon */}
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                        {getStatusIcon()}
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={loadCountdown}
                            disabled={loading}
                            sx={{ minWidth: 120 }}
                        >
                            {loading ? 'Loading...' : 'Refresh'}
                        </Button>
                        
                        <Button
                            variant="outlined"
                            onClick={() => setShowDetails(!showDetails)}
                            sx={{ minWidth: 120 }}
                        >
                            {showDetails ? 'Hide Details' : 'Show Details'}
                        </Button>
                    </Box>

                    {/* Order Details */}
                    {showDetails && countdown?.order_details && (
                        <Box sx={{ 
                            mt: 3, 
                            p: 2, 
                            bgcolor: '#f8f9fa', 
                            borderRadius: 2 
                        }}>
                            <Typography variant="h6" gutterBottom>
                                Order Details
                            </Typography>
                            
                            <Box sx={{ '& > div': { py: 1, borderBottom: '1px solid #eee' } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        Order ID:
                                    </Typography>
                                    <Typography variant="body2">
                                        {orderId}
                                    </Typography>
                                </Box>
                                
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        Phone Number:
                                    </Typography>
                                    <Typography variant="body2">
                                        {countdown.order_details.phone_number}
                                    </Typography>
                                </Box>
                                
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        Service:
                                    </Typography>
                                    <Typography variant="body2">
                                        {countdown.order_details.service_type}
                                    </Typography>
                                </Box>
                                
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        Country:
                                    </Typography>
                                    <Typography variant="body2">
                                        {countdown.order_details.country_id}
                                    </Typography>
                                </Box>
                                
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="textSecondary">
                                        Created:
                                    </Typography>
                                    <Typography variant="body2">
                                        {new Date(countdown.order_details.created_at).toLocaleString()}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default CountdownTimer;
