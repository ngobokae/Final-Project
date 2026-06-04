import { query } from '../config/database.js';

/**
 * Get user permissions from database
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Permissions object with resource as key and actions array as value
 */
export const getUserPermissions = async (userId) => {
  try {
    const permissions = await query(
      'SELECT resource, actions FROM user_permissions WHERE user_id = ?',
      [userId]
    );

    const permissionsObj = {};
    permissions.forEach((perm) => {
      try {
        const parsed = JSON.parse(perm.actions);
        // Treat empty or invalid arrays as "no override" so role defaults still apply
        if (Array.isArray(parsed) && parsed.length > 0) {
          permissionsObj[perm.resource] = parsed;
        }
      } catch (e) {
        // Ignore bad data and fall back to role-based defaults
      }
    });

    return permissionsObj;
  } catch (error) {
    console.error('Get user permissions error:', error);
    return {};
  }
};

/**
 * Check if user has permission for a specific resource and action
 * @param {number} userId - User ID
 * @param {string} resource - Resource name (e.g., 'users', 'products')
 * @param {string} action - Action name (e.g., 'view', 'create', 'edit', 'delete')
 * @returns {Promise<boolean>} True if user has permission
 */
export const hasPermission = async (userId, resource, action) => {
  try {
    const permissions = await getUserPermissions(userId);
    
    // If user has specific permissions configured for this resource,
    // they override role-based defaults (including the case of "no permissions")
    if (Object.prototype.hasOwnProperty.call(permissions, resource)) {
      return permissions[resource].includes(action);
    }

    // If no specific permissions set, check role-based defaults
    const users = await query('SELECT role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return false;
    }

    const role = users[0].role;
    
    // Default role-based permissions (fallback)
    const rolePermissions = {
      admin: {
        dashboard: ['view'],
        users: ['view', 'create', 'edit', 'delete'],
        products: ['view', 'create', 'edit', 'delete'],
        sales: ['view', 'create', 'edit', 'delete'],
        inventory: ['view', 'create', 'edit', 'delete'],
        forecasts: ['view', 'create', 'edit', 'delete'],
        reports: ['view', 'export'],
        settings: ['view', 'edit'],
      },
      operations: {
        dashboard: ['view'],
        products: ['view', 'create', 'edit', 'delete'],
        sales: ['view', 'create', 'edit', 'delete'],
        inventory: ['view', 'create', 'edit', 'delete'],
        forecasts: ['view', 'create', 'edit', 'delete'],
        reports: ['view', 'export'],
      },
      operations_manager: {
        dashboard: ['view'],
        products: ['view'],
        sales: ['view', 'create', 'edit', 'delete'],
        inventory: ['view', 'create', 'edit'],
        forecasts: ['view', 'create', 'edit'],
        procurement: ['view', 'create', 'edit', 'approve'],
        suppliers: ['view', 'report'],
        notifications: ['view', 'subscribe'],
        reports: ['view', 'export'],
        settings: ['view'],
      },
      inventory: {
        dashboard: ['view'],
        products: ['view', 'create', 'edit'],
        sales: ['view'],
        inventory: ['view', 'create', 'edit'],
        forecasts: ['view'],
        reports: ['view', 'export'],
      },
      inventory_manager: {
        dashboard: ['view'],
        products: ['view', 'create', 'edit'],
        sales: ['view'],
        inventory: ['view', 'create', 'edit'],
        procurement: ['view'],
        forecasts: ['view'],
        reports: ['view', 'export'],
      },
      executive: {
        dashboard: ['view'],
        products: ['view'],
        sales: ['view'],
        inventory: ['view'],
        forecasts: ['view'],
        reports: ['view', 'export'],
      },
    };

    const rolePerms = rolePermissions[role] || {};
    return rolePerms[resource]?.includes(action) || false;
  } catch (error) {
    console.error('Check permission error:', error);
    return false;
  }
};

/**
 * Middleware to check user permissions
 * @param {string} resource - Resource name
 * @param {string} action - Action name
 * @returns {Function} Express middleware function
 */
export const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const hasAccess = await hasPermission(req.user.id, resource, action);
      
      if (!hasAccess) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }));
        return;
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Permission check failed' }));
    }
  };
};
