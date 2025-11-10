/**
 * Configuration Module (Backward Compatibility Layer)
 *
 * This file now re-exports from the new shared config layer.
 * It maintains backward compatibility for existing code.
 *
 * @deprecated Use '../shared/config' directly in new code
 */

// Re-export the new shared configuration
module.exports = require('../shared/config');
