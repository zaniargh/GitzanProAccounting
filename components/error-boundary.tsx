"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        if (process.env.NODE_ENV === "development") {
            console.error("Error Boundary caught an error:", error, errorInfo)
        }
        this.setState({
            error,
            errorInfo,
        })
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
                    <Card className="p-8 max-w-2xl w-full">
                        <div className="text-center space-y-4">
                            <div className="text-6xl">😢</div>
                            <h1 className="text-2xl font-bold text-red-600">
                                An error has occurred
                            </h1>
                            <p className="text-muted-foreground">
                                Something went wrong. Please refresh the page.
                            </p>

                            {process.env.NODE_ENV === "development" && this.state.error && (
                                <details className="mt-4 text-left">
                                    <summary className="cursor-pointer text-sm font-mono bg-muted p-2 rounded">
                                        Error details (development only)
                                    </summary>
                                    <pre className="mt-2 p-4 bg-red-50 text-red-900 text-xs overflow-auto rounded border border-red-200">
                                        {this.state.error.toString()}
                                        {this.state.errorInfo?.componentStack}
                                    </pre>
                                </details>
                            )}

                            <div className="flex gap-2 justify-center mt-6">
                                <Button
                                    onClick={() => window.location.reload()}
                                    className="bg-primary text-white"
                                >
                                    Refresh Page
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )
        }

        return this.props.children
    }
}
