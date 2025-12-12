import logger from './logger';

/**
 * Metrics tracking for monitoring and observability
 */

interface RequestMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

interface ChatMetrics {
  messageCount: number;
  assigned: boolean;
  assignee?: string;
  duration: number;
  timestamp: Date;
}

interface ErrorMetrics {
  endpoint: string;
  method: string;
  errorType: string;
  errorMessage: string;
  timestamp: Date;
}

class MetricsCollector {
  private requestMetrics: RequestMetrics[] = [];
  private chatMetrics: ChatMetrics[] = [];
  private errorMetrics: ErrorMetrics[] = [];

  // Counters
  private totalRequests = 0;
  private totalErrors = 0;
  private totalChats = 0;
  private totalAssignments = 0;

  // Keep last 1000 of each type
  private readonly MAX_METRICS = 1000;

  /**
   * Track HTTP request
   */
  trackRequest(metrics: Omit<RequestMetrics, 'timestamp'>): void {
    this.totalRequests++;

    this.requestMetrics.push({
      ...metrics,
      timestamp: new Date()
    });

    // Keep only last MAX_METRICS
    if (this.requestMetrics.length > this.MAX_METRICS) {
      this.requestMetrics.shift();
    }

    // Log slow requests (> 1 second)
    if (metrics.duration > 1000) {
      logger.warn({
        endpoint: metrics.endpoint,
        method: metrics.method,
        duration: metrics.duration
      }, `Slow request: ${metrics.method} ${metrics.endpoint} took ${metrics.duration}ms`);
    }
  }

  /**
   * Track chat interaction
   */
  trackChat(metrics: Omit<ChatMetrics, 'timestamp'>): void {
    this.totalChats++;
    if (metrics.assigned) {
      this.totalAssignments++;
    }

    this.chatMetrics.push({
      ...metrics,
      timestamp: new Date()
    });

    if (this.chatMetrics.length > this.MAX_METRICS) {
      this.chatMetrics.shift();
    }
  }

  /**
   * Track error
   */
  trackError(metrics: Omit<ErrorMetrics, 'timestamp'>): void {
    this.totalErrors++;

    this.errorMetrics.push({
      ...metrics,
      timestamp: new Date()
    });

    if (this.errorMetrics.length > this.MAX_METRICS) {
      this.errorMetrics.shift();
    }
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Filter recent metrics
    const recentRequests = this.requestMetrics.filter(m => m.timestamp > oneHourAgo);
    const dailyRequests = this.requestMetrics.filter(m => m.timestamp > oneDayAgo);
    const recentChats = this.chatMetrics.filter(m => m.timestamp > oneHourAgo);
    const recentErrors = this.errorMetrics.filter(m => m.timestamp > oneHourAgo);

    // Calculate averages
    const avgRequestDuration = recentRequests.length > 0
      ? recentRequests.reduce((sum, m) => sum + m.duration, 0) / recentRequests.length
      : 0;

    const avgChatDuration = recentChats.length > 0
      ? recentChats.reduce((sum, m) => sum + m.duration, 0) / recentChats.length
      : 0;

    // Assignment rate
    const assignmentRate = recentChats.length > 0
      ? (recentChats.filter(m => m.assigned).length / recentChats.length) * 100
      : 0;

    // Error rate
    const errorRate = recentRequests.length > 0
      ? (recentErrors.length / recentRequests.length) * 100
      : 0;

    // Status code distribution
    const statusCodes: Record<number, number> = {};
    recentRequests.forEach(m => {
      statusCodes[m.statusCode] = (statusCodes[m.statusCode] || 0) + 1;
    });

    // Most common errors
    const errorTypes: Record<string, number> = {};
    recentErrors.forEach(m => {
      errorTypes[m.errorType] = (errorTypes[m.errorType] || 0) + 1;
    });

    return {
      overview: {
        totalRequests: this.totalRequests,
        totalChats: this.totalChats,
        totalAssignments: this.totalAssignments,
        totalErrors: this.totalErrors
      },
      lastHour: {
        requests: recentRequests.length,
        chats: recentChats.length,
        errors: recentErrors.length,
        avgRequestDuration: Math.round(avgRequestDuration),
        avgChatDuration: Math.round(avgChatDuration),
        assignmentRate: Math.round(assignmentRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100
      },
      last24Hours: {
        requests: dailyRequests.length
      },
      statusCodes,
      errorTypes,
      topEndpoints: this.getTopEndpoints(recentRequests),
      slowestEndpoints: this.getSlowestEndpoints(recentRequests)
    };
  }

  /**
   * Get top endpoints by request count
   */
  private getTopEndpoints(metrics: RequestMetrics[]): Array<{endpoint: string; count: number}> {
    const counts: Record<string, number> = {};

    metrics.forEach(m => {
      const key = `${m.method} ${m.endpoint}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  /**
   * Get slowest endpoints by average duration
   */
  private getSlowestEndpoints(metrics: RequestMetrics[]): Array<{endpoint: string; avgDuration: number}> {
    const durations: Record<string, { total: number; count: number }> = {};

    metrics.forEach(m => {
      const key = `${m.method} ${m.endpoint}`;
      if (!durations[key]) {
        durations[key] = { total: 0, count: 0 };
      }
      durations[key].total += m.duration;
      durations[key].count += 1;
    });

    return Object.entries(durations)
      .map(([endpoint, { total, count }]) => ({
        endpoint,
        avgDuration: Math.round(total / count)
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);
  }

  /**
   * Get health status
   */
  getHealth() {
    const summary = this.getSummary();
    const lastHour = summary.lastHour;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const issues: string[] = [];

    // Check error rate
    if (lastHour.errorRate > 10) {
      status = 'unhealthy';
      issues.push(`High error rate: ${lastHour.errorRate}%`);
    } else if (lastHour.errorRate > 5) {
      status = 'degraded';
      issues.push(`Elevated error rate: ${lastHour.errorRate}%`);
    }

    // Check assignment rate
    if (lastHour.chats > 10 && lastHour.assignmentRate < 50) {
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
      issues.push(`Low assignment rate: ${lastHour.assignmentRate}%`);
    }

    // Check response time
    if (lastHour.avgRequestDuration > 2000) {
      status = 'unhealthy';
      issues.push(`Very slow response time: ${lastHour.avgRequestDuration}ms`);
    } else if (lastHour.avgRequestDuration > 1000) {
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
      issues.push(`Slow response time: ${lastHour.avgRequestDuration}ms`);
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      issues,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
      },
      metrics: {
        requestsLastHour: lastHour.requests,
        chatsLastHour: lastHour.chats,
        errorsLastHour: lastHour.errors,
        avgResponseTime: lastHour.avgRequestDuration,
        errorRate: lastHour.errorRate,
        assignmentRate: lastHour.assignmentRate
      }
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.requestMetrics = [];
    this.chatMetrics = [];
    this.errorMetrics = [];
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.totalChats = 0;
    this.totalAssignments = 0;
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

export default metrics;
