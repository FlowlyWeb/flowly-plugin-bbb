#!/bin/sh
# ==============================================================================
# Flowly Plugin - Container Entrypoint
# ==============================================================================
# Replaces configuration placeholders with environment variables at runtime.
# This allows the plugin to be configured without rebuilding the image.
#
# Environment variables:
#   FLOWLY_API_URL    - API endpoint URL (required)
#   FLOWLY_PLUGIN_URL - Plugin URL for manifest (optional, defaults to relative paths)

set -e

DIST_DIR="/usr/share/nginx/html"

# ==============================================================================
# Replace API URL placeholder in JavaScript bundles (both BBB versions)
# ==============================================================================
if [ -n "$FLOWLY_API_URL" ]; then
    echo "Configuring API URL: $FLOWLY_API_URL"

    # Replace placeholder in BBB 3.0 bundle
    if [ -f "$DIST_DIR/3.0/FlowlyWebIntegration.js" ]; then
        sed -i "s|__FLOWLY_API_URL__|${FLOWLY_API_URL}|g" "$DIST_DIR/3.0/FlowlyWebIntegration.js"
        echo "✓ Updated 3.0/FlowlyWebIntegration.js"
    fi

    # Replace placeholder in BBB 3.1 bundle
    if [ -f "$DIST_DIR/3.1/FlowlyWebIntegration.js" ]; then
        sed -i "s|__FLOWLY_API_URL__|${FLOWLY_API_URL}|g" "$DIST_DIR/3.1/FlowlyWebIntegration.js"
        echo "✓ Updated 3.1/FlowlyWebIntegration.js"
    fi
else
    echo "Warning: FLOWLY_API_URL not set, the plugin will not reach any API"
fi

# ==============================================================================
# Replace Plugin URL placeholder in manifests (both BBB versions)
# ==============================================================================
if [ -n "$FLOWLY_PLUGIN_URL" ]; then
    echo "Configuring Plugin URL: $FLOWLY_PLUGIN_URL"

    # Update BBB 3.0 manifest
    if [ -f "$DIST_DIR/3.0/manifest.json" ]; then
        sed -i "s|__FLOWLY_PLUGIN_URL__|${FLOWLY_PLUGIN_URL}|g" "$DIST_DIR/3.0/manifest.json"
        echo "✓ Updated 3.0/manifest.json"
    fi

    # Update BBB 3.1 manifest
    if [ -f "$DIST_DIR/3.1/manifest.json" ]; then
        sed -i "s|__FLOWLY_PLUGIN_URL__|${FLOWLY_PLUGIN_URL}|g" "$DIST_DIR/3.1/manifest.json"
        echo "✓ Updated 3.1/manifest.json"
    fi
else
    echo "Warning: FLOWLY_PLUGIN_URL not set, using relative paths"
    # Use relative paths (works when BBB loads from same origin)
    if [ -f "$DIST_DIR/3.0/manifest.json" ]; then
        sed -i "s|__FLOWLY_PLUGIN_URL__/||g" "$DIST_DIR/3.0/manifest.json"
    fi
    if [ -f "$DIST_DIR/3.1/manifest.json" ]; then
        sed -i "s|__FLOWLY_PLUGIN_URL__/||g" "$DIST_DIR/3.1/manifest.json"
    fi
fi

echo "Flowly plugin configuration complete."
