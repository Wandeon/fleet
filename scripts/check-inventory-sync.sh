#!/bin/bash
set -e

echo "🔍 Checking inventory ↔ monitoring synchronization..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

INVENTORY_FILE="inventory/device-interfaces.yaml"
TARGETS_DIR="infra/vps"

if [ ! -f "$INVENTORY_FILE" ]; then
    echo "❌ Inventory file not found: $INVENTORY_FILE"
    exit 1
fi

if [ ! -d "$TARGETS_DIR" ]; then
    echo "❌ Targets directory not found: $TARGETS_DIR"
    exit 1
fi

echo "📋 Parsing devices from $INVENTORY_FILE..."

# Extract device info from YAML using a simple parser
DEVICES_INFO=$(python3 -c "
import yaml
import sys

try:
    with open('$INVENTORY_FILE', 'r') as f:
        data = yaml.safe_load(f)

    devices = data.get('devices', [])
    for device in devices:
        device_id = device.get('id')
        role = device.get('role')
        monitoring = device.get('monitoring', {})
        targets = monitoring.get('prometheus_targets', [])

        for target in targets:
            job = target.get('job')
            target_addr = target.get('target')
            print(f'{device_id}:{role}:{job}:{target_addr}')

except Exception as e:
    print(f'Error parsing YAML: {e}', file=sys.stderr)
    sys.exit(1)
")

if [ $? -ne 0 ]; then
    echo "❌ Failed to parse inventory YAML"
    echo "Make sure Python3 and PyYAML are available"
    echo "Install with: pip3 install PyYAML"
    exit 1
fi

echo "🎯 Expected Prometheus targets from inventory:"
echo "$DEVICES_INFO" | while IFS=: read -r device_id role job target_addr; do
    echo "  Device: $device_id, Role: $role, Job: $job, Target: $target_addr"
done

echo ""
echo "📋 Checking existing target files in $TARGETS_DIR..."

# Find all target files
TARGET_FILES=$(find "$TARGETS_DIR" -name "targets-*.json")

if [ -z "$TARGET_FILES" ]; then
    echo "❌ No target files found in $TARGETS_DIR"
    exit 1
fi

# Parse existing targets
EXISTING_TARGETS=""
for target_file in $TARGET_FILES; do
    echo "📄 Parsing $target_file..."

    TARGETS_FROM_FILE=$(python3 -c "
import json
import sys

try:
    with open('$target_file', 'r') as f:
        data = json.load(f)

    for entry in data:
        targets = entry.get('targets', [])
        labels = entry.get('labels', {})
        role = labels.get('role', 'unknown')
        instance = labels.get('instance', 'unknown')

        for target in targets:
            print(f'{instance}:{role}:{target}')

except Exception as e:
    print(f'Error parsing JSON: {e}', file=sys.stderr)
    sys.exit(1)
")

    if [ $? -ne 0 ]; then
        echo "❌ Failed to parse $target_file"
        exit 1
    fi

    EXISTING_TARGETS="$EXISTING_TARGETS$TARGETS_FROM_FILE"$'\n'
done

echo "🎯 Current Prometheus targets from files:"
echo "$EXISTING_TARGETS" | grep -v '^$' | while IFS=: read -r instance role target; do
    echo "  Instance: $instance, Role: $role, Target: $target"
done

echo ""
echo "🔍 Checking for synchronization issues..."

SYNC_ISSUES=false

# Check if all inventory devices have corresponding targets
echo "$DEVICES_INFO" | while IFS=: read -r device_id role job target_addr; do
    if ! echo "$EXISTING_TARGETS" | grep -q "$device_id:.*:$target_addr"; then
        echo "❌ MISSING TARGET: Device $device_id ($role) expects target $target_addr but not found in target files"
        SYNC_ISSUES=true
    fi
done

# Check if all targets have corresponding inventory entries
echo "$EXISTING_TARGETS" | grep -v '^$' | while IFS=: read -r instance role target; do
    if ! echo "$DEVICES_INFO" | grep -q "$instance:.*:.*:$target"; then
        echo "⚠️  ORPHANED TARGET: Target $target for $instance exists in files but not in inventory"
        SYNC_ISSUES=true
    fi
done

# Check for role mismatches
echo "$DEVICES_INFO" | while IFS=: read -r device_id role job target_addr; do
    EXISTING_ROLE=$(echo "$EXISTING_TARGETS" | grep "$device_id:" | head -1 | cut -d: -f2)
    if [ -n "$EXISTING_ROLE" ] && [ "$EXISTING_ROLE" != "$role" ]; then
        echo "❌ ROLE MISMATCH: Device $device_id has role '$role' in inventory but '$EXISTING_ROLE' in targets"
        SYNC_ISSUES=true
    fi
done

if [ "$SYNC_ISSUES" = true ]; then
    echo ""
    echo "🔧 To fix inventory synchronization issues:"
    echo "1. Update target files in $TARGETS_DIR to match inventory"
    echo "2. Or update $INVENTORY_FILE to match actual monitoring setup"
    echo "3. Ensure device IDs, roles, and target addresses are consistent"
    echo ""
    echo "Expected target file structure:"
    echo "$DEVICES_INFO" | while IFS=: read -r device_id role job target_addr; do
        echo "  {"
        echo "    \"targets\": [\"$target_addr\"],"
        echo "    \"labels\": { \"role\": \"$role\", \"instance\": \"$device_id\" }"
        echo "  },"
    done
    echo ""
    exit 1
fi

echo "✅ Inventory and monitoring targets are synchronized"