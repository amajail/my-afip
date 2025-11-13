/**
 * Validators Module (Backward Compatibility Layer)
 *
 * This file now re-exports from the new shared validation layer.
 * It maintains backward compatibility for existing code.
 *
 * @deprecated Use '../shared/validation/validators' directly in new code
 */

// Re-export all validators from shared validation layer
module.exports = require('../shared/validation/validators');
