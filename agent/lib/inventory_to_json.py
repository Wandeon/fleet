#!/usr/bin/env python3
"""Convert inventory/devices.yaml to JSON without external deps."""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from typing import Dict, Any


def parse_devices_yaml(text: str) -> Dict[str, Dict[str, Any]]:
    devices: Dict[str, Dict[str, Any]] = {}
    current_section = None
    current_device = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        if indent == 0:
            current_section = stripped.rstrip(":")
            current_device = None
            continue
        if current_section != "devices":
            continue
        if indent == 2 and stripped.endswith(":"):
            current_device = stripped.rstrip(":")
            devices.setdefault(current_device, {})
            continue
        if indent >= 4 and ":" in stripped and current_device:
            key, value = stripped.split(":", 1)
            key = key.strip()
            value = value.strip()
            if "#" in value:
                value = value.split("#", 1)[0].strip()
            if value.startswith(("'", '"')) and value.endswith(("'", '"')):
                value = value[1:-1]
            devices[current_device][key] = value
    return devices


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inventory", type=pathlib.Path)
    args = parser.parse_args()

    try:
        text = args.inventory.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"inventory file not found: {args.inventory}", file=sys.stderr)
        return 1

    devices = parse_devices_yaml(text)
    json.dump(devices, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
