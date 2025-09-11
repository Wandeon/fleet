# ADR 0001: GitOps for Fleet Management

## Status

Accepted

## Context

Managing a fleet of Raspberry Pi devices requires a single source of truth and
repeatable deployments.

## Decision

Store all device configuration and deployment code in a Git repository and use
a convergence agent to apply changes.

## Consequences

- Enables pull-request workflows and change history.
- Devices must have network access to fetch repository updates.
