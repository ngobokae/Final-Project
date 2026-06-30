import 'dotenv/config';
import http from 'http';
import url from 'url';
import { authenticate, authorize } from './middleware/auth.js';
import * as authRoutes from './routes/auth.js';
import * as userRoutes from './routes/users.js';
import * as productRoutes from './routes/products.js';
import * as salesRoutes from './routes/sales.js';
import * as inventoryRoutes from './routes/inventory.js';
import * as forecastRoutes from './routes/forecast.js';
const { ensureForecastSchema } = forecastRoutes;
import * as dashboardRoutes from './routes/dashboard.js';
import * as auditRoutes from './routes/audit.js';
import * as productionRoutes from './routes/production.js';
import * as procurementRoutes from './routes/procurement.js';
import * as kpisRoutes from './routes/kpis.js';
import * as settingsRoutes from './routes/settings.js';
import * as insightsRoutes from './routes/insights.js';
import * as adminRoutes from './routes/admin.js';
import * as demandModelsRoutes from './routes/demandModels.js';
import * as reportsRoutes from './routes/reports.js';
import * as messagesRoutes from './routes/messages.js';
import * as contactRoutes from './routes/contact.js';
import { sendError } from './utils/helpers.js';
import { checkPermission } from './utils/permissions.js';
import { ensureMoneyColumnPrecision } from './utils/schema.js';

import { initSocket } from './utils/socket.js';

const PORT = process.env.PORT || 3001;

const routes = {
  // Auth routes (no authentication required)
  'POST /api/auth/login': { handler: authRoutes.handleLogin, auth: false },
  'GET /api/auth/verify': { handler: authRoutes.handleVerifyToken, auth: true },
  'POST /api/auth/forgot-password': { handler: authRoutes.handleForgotPassword, auth: false },
  'POST /api/auth/reset-password': { handler: authRoutes.handleResetPassword, auth: false },
  'POST /api/auth/2fa/setup': { handler: authRoutes.handle2FASetup, auth: true },
  'POST /api/auth/2fa/activate': { handler: authRoutes.handle2FAVerifyActivate, auth: true },
  'POST /api/auth/2fa/disable': { handler: authRoutes.handle2FADisable, auth: true },
  'POST /api/auth/2fa/login-verify': { handler: authRoutes.handle2FALoginVerify, auth: false },

  // User routes
  'GET /api/users/me': { handler: userRoutes.handleGetMe, auth: true },
  'PUT /api/users/me': { handler: userRoutes.handleUpdateMe, auth: true },
  'PUT /api/users/me/password': { handler: userRoutes.handleUpdateMyPassword, auth: true },
  'GET /api/users/me/preferences': { handler: userRoutes.handleGetMyPreferences, auth: true },
  'PUT /api/users/me/preferences': { handler: userRoutes.handleUpdateMyPreferences, auth: true },
  'GET /api/users/me/activity': { handler: userRoutes.handleGetMyActivity, auth: true },
  'GET /api/users/me/login-history': { handler: userRoutes.handleGetMyLoginHistory, auth: true },
  'GET /api/users/me/sessions': { handler: userRoutes.handleGetMySessions, auth: true },
  'POST /api/users/me/sessions/revoke-others': { handler: userRoutes.handleRevokeOtherSessions, auth: true },
  'GET /api/users/list': { handler: userRoutes.handleGetUsersForMessaging, auth: true },
  'GET /api/users': { handler: userRoutes.handleGetUsers, auth: true, roles: ['admin'], permission: { resource: 'users', action: 'view' } },
  'POST /api/users': { handler: userRoutes.handleCreateUser, auth: true, roles: ['admin'], permission: { resource: 'users', action: 'create' } },
  'PUT /api/users/:id': { handler: userRoutes.handleUpdateUser, auth: true, roles: ['admin'], permission: { resource: 'users', action: 'edit' } },
  'DELETE /api/users/:id': { handler: userRoutes.handleDeleteUser, auth: true, roles: ['admin'], permission: { resource: 'users', action: 'delete' } },
  'GET /api/users/:id/permissions': { handler: userRoutes.handleGetUserPermissions, auth: true, roles: ['admin'], permission: { resource: 'settings', action: 'view' } },
  'PUT /api/users/:id/permissions': { handler: userRoutes.handleUpdateUserPermissions, auth: true, roles: ['admin'], permission: { resource: 'settings', action: 'edit' } },

  // Product routes
  'GET /api/products': { handler: productRoutes.handleGetProducts, auth: true, permission: { resource: 'products', action: 'view' } },
  'GET /api/products/:id': { handler: productRoutes.handleGetProduct, auth: true, permission: { resource: 'products', action: 'view' } },
  'POST /api/products': { handler: productRoutes.handleCreateProduct, auth: true, roles: ['admin', 'operations', 'inventory', 'inventory_manager'], permission: { resource: 'products', action: 'create' } },
  'POST /api/products/upload': { handler: productRoutes.handleUploadProducts, auth: true, roles: ['admin', 'operations', 'inventory', 'inventory_manager'], permission: { resource: 'products', action: 'create' } },
  'PUT /api/products/:id': { handler: productRoutes.handleUpdateProduct, auth: true, roles: ['admin', 'operations', 'inventory', 'inventory_manager'], permission: { resource: 'products', action: 'edit' } },

  // Sales routes
  'GET /api/sales': { handler: salesRoutes.handleGetSales, auth: true, permission: { resource: 'sales', action: 'view' } },
  'GET /api/sales/stats': { handler: salesRoutes.handleGetSalesStats, auth: true, permission: { resource: 'sales', action: 'view' } },
  'GET /api/sales/product-ids': { handler: salesRoutes.handleGetSalesProductIds, auth: true, permission: { resource: 'sales', action: 'view' } },
  'GET /api/sales/:id': { handler: salesRoutes.handleGetSale, auth: true, permission: { resource: 'sales', action: 'view' } },
  'POST /api/sales': { handler: salesRoutes.handleCreateSale, auth: true, roles: ['admin', 'operations', 'operations_manager'], permission: { resource: 'sales', action: 'create' } },
  'PUT /api/sales/:id': { handler: salesRoutes.handleUpdateSale, auth: true, roles: ['admin', 'operations'], permission: { resource: 'sales', action: 'edit' } },
  'DELETE /api/sales': { handler: salesRoutes.handleDeleteAllSales, auth: true, roles: ['admin', 'operations'], permission: { resource: 'sales', action: 'delete' } },
  'DELETE /api/sales/:id': { handler: salesRoutes.handleDeleteSale, auth: true, roles: ['admin', 'operations'], permission: { resource: 'sales', action: 'delete' } },
  'POST /api/sales/upload': { handler: salesRoutes.handleUploadSales, auth: true, roles: ['admin', 'operations', 'operations_manager'], permission: { resource: 'sales', action: 'create' } },

  // Inventory routes
  'GET /api/inventory': { handler: inventoryRoutes.handleGetInventory, auth: true, permission: { resource: 'inventory', action: 'view' } },
  'GET /api/inventory/alerts': { handler: inventoryRoutes.handleGetInventoryAlerts, auth: true, permission: { resource: 'inventory', action: 'view' } },
  'GET /api/inventory/report/csv': { handler: inventoryRoutes.handleExportInventoryCsv, auth: true, permission: { resource: 'inventory', action: 'view' } },
  'PUT /api/inventory/alerts/:id/resolve': { handler: inventoryRoutes.handleResolveAlert, auth: true, roles: ['admin', 'inventory', 'inventory_manager'], permission: { resource: 'inventory', action: 'edit' } },
  'GET /api/inventory/history': { handler: inventoryRoutes.handleGetInventoryHistory, auth: true, roles: ['admin', 'inventory', 'inventory_manager'], permission: { resource: 'inventory', action: 'view' } },
  'GET /api/inventory/transactions': { handler: inventoryRoutes.handleGetInventoryTransactions, auth: true, roles: ['admin', 'inventory', 'operations', 'inventory_manager'], permission: { resource: 'inventory', action: 'view' } },
  'POST /api/inventory/transactions': { handler: inventoryRoutes.handleCreateInventoryTransaction, auth: true, roles: ['admin', 'inventory', 'operations', 'inventory_manager'], permission: { resource: 'inventory', action: 'edit' } },
  'PUT /api/inventory/:id': { handler: inventoryRoutes.handleUpdateInventory, auth: true, roles: ['admin', 'inventory', 'inventory_manager'], permission: { resource: 'inventory', action: 'edit' } },
  'DELETE /api/inventory': { handler: inventoryRoutes.handleDeleteAllInventoryData, auth: true, roles: ['admin', 'inventory', 'inventory_manager'], permission: { resource: 'inventory', action: 'edit' } },
  'GET /api/inventory/pending-receivables': { handler: inventoryRoutes.handleGetPendingProcurementReceivables, auth: true, roles: ['admin', 'inventory', 'inventory_manager', 'operations', 'operations_manager'], permission: { resource: 'inventory', action: 'view' } },
  'POST /api/inventory/receive-procurement': { handler: inventoryRoutes.handleReceiveProcurementGoods, auth: true, roles: ['admin', 'inventory', 'inventory_manager', 'operations', 'operations_manager'], permission: { resource: 'inventory', action: 'edit' } },

  // Forecast routes
  'GET /api/forecast': { handler: forecastRoutes.handleGetForecasts, auth: true, permission: { resource: 'forecasts', action: 'view' } },
  'POST /api/forecast/generate': { handler: forecastRoutes.handleGenerateForecast, auth: true, roles: ['admin', 'operations', 'executive', 'operations_manager'], permission: { resource: 'forecasts', action: 'create' } },
  'POST /api/forecast/generate-bulk': { handler: forecastRoutes.handleBulkGenerateForecast, auth: true, roles: ['admin', 'operations', 'executive', 'operations_manager'], permission: { resource: 'forecasts', action: 'create' } },
  'DELETE /api/forecast': { handler: forecastRoutes.handleDeleteForecasts, auth: true, roles: ['admin', 'operations', 'executive', 'operations_manager'], permission: { resource: 'forecasts', action: 'delete' } },
  'GET /api/forecast/recommendations': { handler: forecastRoutes.handleGetInventoryRecommendations, auth: true, permission: { resource: 'forecasts', action: 'view' } },
  'POST /api/forecast/recommendations': { handler: forecastRoutes.handleGenerateRecommendations, auth: true, roles: ['admin', 'inventory', 'executive', 'operations_manager'], permission: { resource: 'forecasts', action: 'create' } },
  'POST /api/forecast/upload-data': { handler: forecastRoutes.handleUploadForecastData, auth: true, roles: ['admin', 'operations', 'operations_manager'], permission: { resource: 'forecasts', action: 'create' } },
  'POST /api/forecast/predict-upload': { handler: forecastRoutes.handlePredictFromUpload, auth: true, roles: ['admin', 'operations', 'operations_manager'], permission: { resource: 'forecasts', action: 'create' } },
  'POST /api/forecast/clear': { handler: forecastRoutes.handleClearForecasts, auth: true, roles: ['admin', 'operations', 'operations_manager'], permission: { resource: 'forecasts', action: 'delete' } },

  // Demand models (shared)
  'GET /api/demand-models': { handler: demandModelsRoutes.handleGetDemandModels, auth: true, permission: { resource: 'forecasts', action: 'view' } },

  // Dashboard routes
  'GET /api/dashboard/stats': { handler: dashboardRoutes.handleGetDashboardStats, auth: true, permission: { resource: 'dashboard', action: 'view' } },
  'GET /api/dashboard/operations': { handler: dashboardRoutes.handleGetOperationsDashboard, auth: true },
  'GET /api/dashboard/inventory': { handler: dashboardRoutes.handleGetInventoryDashboard, auth: true },
  'GET /api/dashboard/executive': { handler: dashboardRoutes.handleGetExecutiveDashboard, auth: true },
  'GET /api/dashboard/sales-chart': { handler: dashboardRoutes.handleGetSalesChart, auth: true },
  'GET /api/dashboard/inventory-chart': { handler: dashboardRoutes.handleGetInventoryChart, auth: true },
  'GET /api/dashboard/forecast-chart': { handler: dashboardRoutes.handleGetForecastChart, auth: true },
  'GET /api/dashboard/category-performance': { handler: dashboardRoutes.handleGetCategoryPerformance, auth: true },
  'GET /api/dashboard/regional-data': { handler: dashboardRoutes.handleGetRegionalData, auth: true },
  'GET /api/dashboard/health-metrics': { handler: dashboardRoutes.handleGetHealthMetrics, auth: true },
  'GET /api/dashboard/revenue-profit-trend': { handler: dashboardRoutes.handleGetRevenueProfitTrend, auth: true },
  'GET /api/dashboard/demand-forecast-metrics': { handler: dashboardRoutes.handleGetDemandForecastMetrics, auth: true },
  'GET /api/dashboard/analytics-metrics': { handler: dashboardRoutes.handleGetAnalyticsMetrics, auth: true },
  'GET /api/dashboard/procurement-metrics': { handler: dashboardRoutes.handleGetProcurementMetrics, auth: true },
  'GET /api/dashboard/production-metrics': { handler: dashboardRoutes.handleGetProductionMetrics, auth: true },

  // Audit routes (admin only)
  'GET /api/audit': { handler: auditRoutes.handleGetAuditLogs, auth: true, roles: ['admin'], permission: { resource: 'reports', action: 'view' } },

  // Production Plan routes
  'GET /api/production': { handler: productionRoutes.handleGetProductionPlans, auth: true },
  'GET /api/production/stats': { handler: productionRoutes.handleGetProductionStats, auth: true },
  'GET /api/production/plans': { handler: dashboardRoutes.handleGetProductionPlans, auth: true },
  'GET /api/production/:id': { handler: productionRoutes.handleGetProductionPlan, auth: true },
  'POST /api/production': { handler: productionRoutes.handleCreateProductionPlan, auth: true, roles: ['admin', 'operations'] },
  'POST /api/production/generate-from-forecasts': { handler: productionRoutes.handleGenerateProductionFromForecasts, auth: true, roles: ['admin', 'operations', 'executive'] },
  'PUT /api/production/:id': { handler: productionRoutes.handleUpdateProductionPlan, auth: true, roles: ['admin', 'operations'] },
  'DELETE /api/production/:id': { handler: productionRoutes.handleDeleteProductionPlan, auth: true, roles: ['admin', 'operations'] },

  // Procurement routes
  'GET /api/procurement': { handler: procurementRoutes.handleGetProcurementOrders, auth: true },
  'GET /api/procurement/stats': { handler: procurementRoutes.handleGetProcurementStats, auth: true },
  'GET /api/procurement/analytics': { handler: procurementRoutes.handleGetSupplierAnalytics, auth: true },
  'GET /api/procurement/trends': { handler: procurementRoutes.handleGetProcurementCostTrends, auth: true },
  'GET /api/procurement/recommendations': { handler: dashboardRoutes.handleGetProcurementRecommendations, auth: true },
  'GET /api/procurement/:id': { handler: procurementRoutes.handleGetProcurementOrder, auth: true },
  'POST /api/procurement': { handler: procurementRoutes.handleCreateProcurementOrder, auth: true, roles: ['admin', 'inventory', 'inventory_manager'] },
  'PUT /api/procurement/:id': { handler: procurementRoutes.handleUpdateProcurementOrder, auth: true, roles: ['admin', 'operations', 'operations_manager', 'executive'] },
  'DELETE /api/procurement/:id': { handler: procurementRoutes.handleDeleteProcurementOrder, auth: true, roles: ['admin', 'operations', 'operations_manager'] },

  // KPI routes
  'GET /api/kpis': { handler: kpisRoutes.handleGetKPIs, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/kpis/summary': { handler: kpisRoutes.handleGetKPISummary, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/kpis/:id': { handler: kpisRoutes.handleGetKPI, auth: true, permission: { resource: 'reports', action: 'view' } },
  'POST /api/kpis': { handler: kpisRoutes.handleCreateKPI, auth: true, roles: ['admin', 'executive'], permission: { resource: 'reports', action: 'edit' } },
  'POST /api/kpis/recalculate': { handler: kpisRoutes.handleRecalculateKPIs, auth: true, roles: ['admin', 'operations', 'operations_manager', 'executive'], permission: { resource: 'reports', action: 'view' } },
  'PUT /api/kpis/:id': { handler: kpisRoutes.handleUpdateKPI, auth: true, roles: ['admin', 'executive'], permission: { resource: 'reports', action: 'edit' } },

  // Settings routes (admin only)
  'GET /api/settings': { handler: settingsRoutes.handleGetSettings, auth: true, roles: ['admin'], permission: { resource: 'settings', action: 'view' } },
  'GET /api/settings/:key': { handler: settingsRoutes.handleGetSetting, auth: true, roles: ['admin'], permission: { resource: 'settings', action: 'view' } },
  'POST /api/settings': { handler: settingsRoutes.handleCreateSetting, auth: true, roles: ['admin'], permission: { resource: 'settings', action: 'edit' } },
  'PUT /api/settings': { handler: settingsRoutes.handleUpdateSettings, auth: true, roles: ['admin'], permission: { resource: 'settings', action: 'edit' } },
  'POST /api/settings/test-email': { handler: settingsRoutes.handleSendTestAlertEmail, auth: true, roles: ['admin'], permission: { resource: 'settings', action: 'edit' } },

  // AI Insights routes
  'GET /api/insights': { handler: insightsRoutes.handleGetInsights, auth: true },
  'GET /api/insights/stats': { handler: insightsRoutes.handleGetInsightStats, auth: true },
  'GET /api/insights/:id': { handler: insightsRoutes.handleGetInsight, auth: true },
  'POST /api/insights': { handler: insightsRoutes.handleCreateInsight, auth: true, roles: ['admin'] },
  'POST /api/insights/generate': { handler: insightsRoutes.handleGenerateInsights, auth: true, roles: ['admin', 'executive'] },
  'PUT /api/insights/:id/dismiss': { handler: insightsRoutes.handleDismissInsight, auth: true },

  // Admin routes
  'PUT /api/admin/permissions': { handler: adminRoutes.handleUpdatePermissions, auth: true, roles: ['admin'] },
  'PUT /api/admin/alert-settings': { handler: adminRoutes.handleUpdateAlertSettings, auth: true, roles: ['admin'] },
  'PUT /api/admin/demand-models': { handler: demandModelsRoutes.handleUpdateDemandModels, auth: true, roles: ['admin'], permission: { resource: 'settings', action: 'edit' } },
  'GET /api/admin/backups': { handler: adminRoutes.handleGetBackups, auth: true, roles: ['admin'] },
  'POST /api/admin/backups': { handler: adminRoutes.handleCreateBackup, auth: true, roles: ['admin'] },
  'POST /api/admin/backups/:id/restore': { handler: adminRoutes.handleRestoreBackup, auth: true, roles: ['admin'] },
  'GET /api/admin/db-export': { handler: adminRoutes.handleDbExport, auth: true, roles: ['admin'], permission: { resource: 'reports', action: 'export' } },
  'GET /api/products/categories': { handler: adminRoutes.handleGetCategories, auth: true },
  'GET /api/admin/dashboard': { handler: adminRoutes.handleGetAdminDashboard, auth: true, roles: ['admin'] },
  'GET /api/admin/health-status': { handler: adminRoutes.handleGetHealthStatus, auth: true, roles: ['admin'] },
  'GET /api/admin/sessions': { handler: adminRoutes.handleGetAdminSessions, auth: true, roles: ['admin'] },
  'DELETE /api/admin/sessions/:sessionId': { handler: adminRoutes.handleRevokeAdminSession, auth: true, roles: ['admin'] },

  // Reports routes
  'GET /api/reports/sales': { handler: reportsRoutes.handleGenerateSalesReport, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/production': { handler: reportsRoutes.handleGenerateProductionReport, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/demand-forecast': { handler: reportsRoutes.handleGenerateDemandForecastReport, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/stock-level': { handler: reportsRoutes.handleGenerateStockLevelReport, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/inventory-valuation': { handler: reportsRoutes.handleGenerateInventoryValuationReport, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/inventory-forecast-errors': { handler: reportsRoutes.handleGenerateInventoryForecastErrorReport, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/inventory-abc-analysis': { handler: reportsRoutes.handleGenerateInventoryABCAnalysisReport, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/executive-summary': { handler: reportsRoutes.handleGenerateExecutiveSummary, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/financial': { handler: reportsRoutes.handleGenerateFinancialReport, auth: true, permission: { resource: 'reports', action: 'view' } },
  'GET /api/reports/inventory-transactions': { handler: reportsRoutes.handleGenerateInventoryTransactionsReport, auth: true, permission: { resource: 'reports', action: 'view' } },

  // Messages (all authenticated users)
  'GET /api/messages': { handler: messagesRoutes.handleGetMessages, auth: true },
  'POST /api/messages': { handler: messagesRoutes.handleSendMessage, auth: true },
  'GET /api/messages/:id': { handler: messagesRoutes.handleGetMessageThread, auth: true },
  'PUT /api/messages/:id/read': { handler: messagesRoutes.handleMarkMessageRead, auth: true },
  'GET /api/messages/attachments/:id': { handler: messagesRoutes.handleGetAttachment, auth: true },

  // Public website contact + admin inbox
  'POST /api/contact': { handler: contactRoutes.handleSubmitContact, auth: false },
  'GET /api/contact/inquiries': { handler: contactRoutes.handleGetContactInquiries, auth: true, roles: ['admin'] },
  'GET /api/contact/unread-count': { handler: contactRoutes.handleGetContactUnreadCount, auth: true, roles: ['admin'] },
  'PUT /api/contact/inquiries/:id/read': { handler: contactRoutes.handleMarkContactInquiryRead, auth: true, roles: ['admin'] },
};

const matchRoute = (method, pathname) => {
  // Try exact match first
  const exactKey = `${method} ${pathname}`;
  if (routes[exactKey]) {
    return { route: routes[exactKey], params: {} };
  }

  // Try pattern matching for routes with :id or :key
  for (const [routeKey, routeConfig] of Object.entries(routes)) {
    const [routeMethod, routePath] = routeKey.split(' ');

    if (routeMethod !== method) continue;

    // Convert route path to regex
    const routeRegex = new RegExp('^' + routePath.replace(/:[^/]+/g, '([^/]+)') + '$');
    const match = pathname.match(routeRegex);

    if (match) {
      const paramNames = routePath.match(/:[^/]+/g) || [];
      const params = {};
      paramNames.forEach((paramName, index) => {
        params[paramName.substring(1)] = match[index + 1];
      });
      return { route: routeConfig, params };
    }
  }

  return null;
};

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Add query params to request object
    req.query = parsedUrl.query;
    req.url = pathname; // Use pathname without query for routing

    const routeMatch = matchRoute(method, pathname);

    if (!routeMatch) {
      return sendError(res, 404, 'Route not found');
    }

    const { route, params } = routeMatch;
    req.params = params;

    // Apply authentication / authorization / per-user permission middleware
    if (route.auth) {
      await authenticate(req, res, () => {
        const runHandler = () => route.handler(req, res);

        const runWithPermission = () => {
          if (route.permission) {
            const permMiddleware = checkPermission(route.permission.resource, route.permission.action);
            permMiddleware(req, res, runHandler);
          } else {
            runHandler();
          }
        };

        if (route.roles) {
          authorize(...route.roles)(req, res, runWithPermission);
        } else {
          runWithPermission();
        }
      });
    } else {
      route.handler(req, res);
    }
  } catch (error) {
    console.error('Server error:', error);
    sendError(res, 500, 'Internal server error');
  }
});

server.listen(PORT, async () => {
  initSocket(server);
  try {
    await ensureForecastSchema();
    console.log('✅ Forecast tables ready');
  } catch (error) {
    console.error('⚠️ Forecast schema init failed:', error.message);
  }
  try {
    await ensureMoneyColumnPrecision();
    console.log('✅ Money column precision ready');
  } catch (error) {
    console.error('⚠️ Money column migration failed:', error.message);
  }
  console.log(`🚀 Pure Node.js Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME || 'manufacturing_system'}`);
  console.log(`🔗 ML Service: ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`);
});
