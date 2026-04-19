import React, { useState, useEffect, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallback }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<Error | undefined>();

    const handleThrow = (error: Error, errorInfo: ErrorInfo) => {
        setHasError(true);
        setError(error);
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    };

    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            handleThrow(new Error(event.message), {
                componentStack: 'No component stack available in global error handler'
            } as ErrorInfo);
        };

        window.addEventListener('error', handleError);
        return () => {
            window.removeEventListener('error', handleError);
        };
    }, []);

    if (hasError) {
        if (fallback) {
            return fallback;
        }

        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="text-center p-8">
                    <div className="mb-4">
                        <span className="material-symbols-outlined text-6xl text-red-500">error</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#181511] dark:text-white mb-2">
                        Something went wrong
                    </h1>
                    <p className="text-[#897b61] dark:text-gray-400 mb-4">
                        An unexpected error occurred. Please refresh the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-[#d48e0d] transition-colors"
                    >
                        Refresh Page
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <details className="mt-4 text-left">
                            <summary className="cursor-pointer text-sm text-gray-500">
                                Error Details (Development)
                            </summary>
                            <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                                {error?.stack}
                            </pre>
                        </details>
                    )}
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ErrorBoundary;