/**
 * Integration test utilities for API services
 * This utility helps test the connection between frontend services and backend API
 */

import { projectService } from '../services/project';
import { pipelineService } from '../services/pipeline';
import { configService } from '../services/config';
import { getApiService } from '../services/base';
import { createProjectWebSocket, createPipelineWebSocket } from './websocket';

export interface IntegrationTestResult {
  service: string;
  endpoint: string;
  success: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export interface WebSocketTestResult {
  endpoint: string;
  success: boolean;
  connectionTime: number;
  error?: string;
  timestamp: Date;
}

export class IntegrationTester {
  private results: IntegrationTestResult[] = [];
  private wsResults: WebSocketTestResult[] = [];

  /**
   * Test all API service endpoints
   */
  async testAllServices(): Promise<{
    apiResults: IntegrationTestResult[];
    wsResults: WebSocketTestResult[];
    summary: {
      totalTests: number;
      passed: number;
      failed: number;
      successRate: number;
    };
  }> {
    console.log('🧪 Starting integration tests...');

    // Test API endpoints
    await this.testApiServices();

    // Test WebSocket connections
    await this.testWebSocketConnections();

    const totalTests = this.results.length + this.wsResults.length;
    const passed =
      this.results.filter(r => r.success).length +
      this.wsResults.filter(r => r.success).length;
    const failed = totalTests - passed;
    const successRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    const summary = {
      totalTests,
      passed,
      failed,
      successRate: Math.round(successRate * 100) / 100,
    };

    console.log('✅ Integration tests completed:', summary);

    return {
      apiResults: [...this.results],
      wsResults: [...this.wsResults],
      summary,
    };
  }

  /**
   * Test API service endpoints
   */
  private async testApiServices(): Promise<void> {
    const tests = [
      {
        name: 'Health Check',
        service: 'base',
        test: () => getApiService().healthCheck(),
      },
      {
        name: 'Get Projects',
        service: 'project',
        test: () => projectService.getProjects({ page: 1, limit: 5 }),
      },
      {
        name: 'Get Project Templates',
        service: 'project',
        test: () => projectService.getProjectTemplates(),
      },
      {
        name: 'Get Config Templates',
        service: 'config',
        test: () => configService.getConfigTemplates(),
      },
      {
        name: 'Get Default Config',
        service: 'config',
        test: () => configService.getDefaultConfig(),
      },
      {
        name: 'Get Available LLM Models',
        service: 'config',
        test: () => configService.getAvailableLLMModels(),
      },
      {
        name: 'Get Available Retrievers',
        service: 'config',
        test: () => configService.getAvailableRetrievers(),
      },
      {
        name: 'Get Pipeline Templates',
        service: 'pipeline',
        test: () => pipelineService.getPipelineTemplates(),
      },
    ];

    for (const { name, service, test } of tests) {
      await this.runApiTest(name, service, test);
    }
  }

  /**
   * Run a single API test
   */
  private async runApiTest(
    name: string,
    service: string,
    testFn: () => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Testing ${name}...`);
      await testFn();

      const responseTime = Date.now() - startTime;
      this.results.push({
        service,
        endpoint: name,
        success: true,
        responseTime,
        timestamp: new Date(),
      });

      console.log(`✅ ${name} - ${responseTime}ms`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.results.push({
        service,
        endpoint: name,
        success: false,
        responseTime,
        error: errorMessage,
        timestamp: new Date(),
      });

      console.log(`❌ ${name} - ${errorMessage} (${responseTime}ms)`);
    }
  }

  /**
   * Test WebSocket connections
   */
  private async testWebSocketConnections(): Promise<void> {
    const wsTests = [
      {
        name: 'Project WebSocket',
        create: () => createProjectWebSocket('test-project-id'),
      },
      {
        name: 'Pipeline WebSocket',
        create: () => createPipelineWebSocket('test-project-id'),
      },
    ];

    for (const { name, create } of wsTests) {
      await this.runWebSocketTest(name, create);
    }
  }

  /**
   * Run a single WebSocket test
   */
  private async runWebSocketTest(
    name: string,
    createWs: () => any
  ): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`🔌 Testing ${name}...`);

      const ws = createWs();

      // Try to connect with timeout
      const connectionPromise = ws.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );

      await Promise.race([connectionPromise, timeoutPromise]);

      const connectionTime = Date.now() - startTime;

      // Clean up
      ws.disconnect();

      this.wsResults.push({
        endpoint: name,
        success: true,
        connectionTime,
        timestamp: new Date(),
      });

      console.log(`✅ ${name} - Connected in ${connectionTime}ms`);
    } catch (error) {
      const connectionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.wsResults.push({
        endpoint: name,
        success: false,
        connectionTime,
        error: errorMessage,
        timestamp: new Date(),
      });

      console.log(`❌ ${name} - ${errorMessage} (${connectionTime}ms)`);
    }
  }

  /**
   * Test specific project operations
   */
  async testProjectOperations(
    projectId: string
  ): Promise<IntegrationTestResult[]> {
    const projectTests = [
      {
        name: 'Get Project Details',
        service: 'project',
        test: () => projectService.getProject(projectId),
      },
      {
        name: 'Get Project Stats',
        service: 'project',
        test: () => projectService.getProjectStats(projectId),
      },
      {
        name: 'Get Project Activity',
        service: 'project',
        test: () => projectService.getProjectActivity(projectId),
      },
      {
        name: 'Get Pipeline Status',
        service: 'pipeline',
        test: () => pipelineService.getPipelineStatus(projectId),
      },
      {
        name: 'Get Pipeline Logs',
        service: 'pipeline',
        test: () => pipelineService.getPipelineLogs(projectId, { limit: 10 }),
      },
      {
        name: 'Get Pipeline Metrics',
        service: 'pipeline',
        test: () => pipelineService.getPipelineMetrics(projectId),
      },
    ];

    const projectResults: IntegrationTestResult[] = [];

    for (const { name, service, test } of projectTests) {
      const startTime = Date.now();

      try {
        console.log(`🔍 Testing ${name} for project ${projectId}...`);
        await test();

        const responseTime = Date.now() - startTime;
        projectResults.push({
          service,
          endpoint: name,
          success: true,
          responseTime,
          timestamp: new Date(),
        });

        console.log(`✅ ${name} - ${responseTime}ms`);
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        projectResults.push({
          service,
          endpoint: name,
          success: false,
          responseTime,
          error: errorMessage,
          timestamp: new Date(),
        });

        console.log(`❌ ${name} - ${errorMessage} (${responseTime}ms)`);
      }
    }

    return projectResults;
  }

  /**
   * Test real-time features
   */
  async testRealTimeFeatures(projectId: string): Promise<{
    success: boolean;
    features: string[];
    errors: string[];
  }> {
    const features: string[] = [];
    const errors: string[] = [];

    console.log('🔄 Testing real-time features...');

    try {
      // Test pipeline logs streaming
      console.log('Testing pipeline logs streaming...');
      const logCleanup = await pipelineService.streamPipelineLogs(
        projectId,
        log => console.log('Received log:', log),
        error => errors.push(`Log streaming: ${error.message}`)
      );

      // Let it run for a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      logCleanup();
      features.push('Pipeline logs streaming');
    } catch (error) {
      errors.push(
        `Pipeline logs streaming: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      // Test metrics subscription
      console.log('Testing metrics subscription...');
      const metricsCleanup = await pipelineService.subscribeToMetrics(
        projectId,
        metrics => console.log('Received metrics:', metrics),
        error => errors.push(`Metrics subscription: ${error.message}`)
      );

      // Let it run for a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      metricsCleanup();
      features.push('Metrics subscription');
    } catch (error) {
      errors.push(
        `Metrics subscription: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      // Test project updates subscription
      console.log('Testing project updates subscription...');
      const projectCleanup = await projectService.subscribeToProjectUpdates(
        projectId,
        {
          onProjectUpdate: project =>
            console.log('Project updated:', project.id),
          onStatusChange: status => console.log('Status changed:', status),
          onError: error => errors.push(`Project updates: ${error.message}`),
        }
      );

      // Let it run for a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      projectCleanup();
      features.push('Project updates subscription');
    } catch (error) {
      errors.push(
        `Project updates: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.log(
      `✅ Real-time features test completed: ${features.length} working, ${errors.length} errors`
    );

    return {
      success: errors.length === 0,
      features,
      errors,
    };
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    const totalTests = this.results.length + this.wsResults.length;
    const passedTests =
      this.results.filter(r => r.success).length +
      this.wsResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    let report = `
# STORM UI Integration Test Report
Generated: ${new Date().toISOString()}

## Summary
- Total Tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${failedTests}
- Success Rate: ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%

## API Endpoints
`;

    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      report += `${status} ${result.endpoint} (${result.service}) - ${result.responseTime}ms\n`;
      if (!result.success && result.error) {
        report += `   Error: ${result.error}\n`;
      }
    });

    report += `\n## WebSocket Connections\n`;

    this.wsResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      report += `${status} ${result.endpoint} - ${result.connectionTime}ms\n`;
      if (!result.success && result.error) {
        report += `   Error: ${result.error}\n`;
      }
    });

    return report;
  }
}

// Export singleton instance
export const integrationTester = new IntegrationTester();

// Convenience functions
export const testIntegration = () => integrationTester.testAllServices();
export const testProjectIntegration = (projectId: string) =>
  integrationTester.testProjectOperations(projectId);
export const testRealTime = (projectId: string) =>
  integrationTester.testRealTimeFeatures(projectId);
