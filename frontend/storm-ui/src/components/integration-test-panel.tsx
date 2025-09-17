'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  integrationTester,
  type IntegrationTestResult,
  type WebSocketTestResult,
} from '@/lib/integration-test';
import { getTestResultColor, getTestResultText } from '@/utils/status';

interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  successRate: number;
}

export function IntegrationTestPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [apiResults, setApiResults] = useState<IntegrationTestResult[]>([]);
  const [wsResults, setWsResults] = useState<WebSocketTestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [report, setReport] = useState<string>('');

  const runTests = async () => {
    setIsRunning(true);
    setApiResults([]);
    setWsResults([]);
    setSummary(null);
    setReport('');

    try {
      const results = await integrationTester.testAllServices();
      setApiResults(results.apiResults);
      setWsResults(results.wsResults);
      setSummary(results.summary);
      setReport(integrationTester.generateReport());
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Integration Test Panel</h2>
          <p className="text-muted-foreground">
            Test the connection between frontend and backend services
          </p>
        </div>
        <Button
          onClick={runTests}
          disabled={isRunning}
          className="min-w-[120px]"
        >
          {isRunning ? 'Running Tests...' : 'Run Tests'}
        </Button>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Test Summary</CardTitle>
            <CardDescription>Overall test results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.totalTests}</div>
                <div className="text-sm text-muted-foreground">Total Tests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {summary.passed}
                </div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {summary.failed}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.successRate}%</div>
                <div className="text-sm text-muted-foreground">
                  Success Rate
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {apiResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>API Endpoint Tests</CardTitle>
            <CardDescription>
              Results for REST API endpoint connectivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {apiResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant={getTestResultColor(result.success)}>
                      {getTestResultText(result.success)}
                    </Badge>
                    <div>
                      <div className="font-medium">{result.endpoint}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.service} service
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {result.responseTime}ms
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {result.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {wsResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>WebSocket Connection Tests</CardTitle>
            <CardDescription>
              Results for real-time WebSocket connectivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {wsResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant={getTestResultColor(result.success)}>
                      {getTestResultText(result.success)}
                    </Badge>
                    <div>
                      <div className="font-medium">{result.endpoint}</div>
                      <div className="text-sm text-muted-foreground">
                        WebSocket connection
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {result.connectionTime}ms
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {result.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {apiResults.some(r => !r.success) ||
        (wsResults.some(r => !r.success) && (
          <Alert>
            <AlertDescription>
              Some tests failed. Check the backend server is running at{' '}
              <code className="font-mono text-sm">
                {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}
              </code>{' '}
              and WebSocket server at{' '}
              <code className="font-mono text-sm">
                {process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'}
              </code>
            </AlertDescription>
          </Alert>
        ))}

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Report</CardTitle>
            <CardDescription>Full test report for debugging</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">
              {report}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
