# Audio Controls Black-Box Testing - Documentation Index

## Quick Navigation

### New User? Start Here

1. **[QUICKSTART.md](QUICKSTART.md)** - Get running in 3 minutes
2. **[DELIVERABLES_SUMMARY.md](DELIVERABLES_SUMMARY.md)** - What you have and how to use it

### Full Documentation

3. **[README.md](README.md)** - Complete documentation (prerequisites, setup, protocol, troubleshooting)
4. **[TEST_SUITE_OVERVIEW.md](TEST_SUITE_OVERVIEW.md)** - Technical details (coverage, architecture, integration)

### Alternative Testing Methods

5. **[MANUAL_TESTING_CHECKLIST.md](MANUAL_TESTING_CHECKLIST.md)** - Manual testing step-by-step guide

### Templates & Examples

6. **[buttons.template.csv](buttons.template.csv)** - Example CSV results format

---

## Documentation Guide

### I want to... Where do I look?

| Goal | Document | Section |
|------|----------|---------|
| **Run tests right now** | QUICKSTART.md | "3-Minute Setup" |
| **Understand what I have** | DELIVERABLES_SUMMARY.md | "What Has Been Delivered" |
| **Set up from scratch** | README.md | "Setup" → "Prerequisites" |
| **Understand test protocol** | README.md | "Test Protocol" |
| **Run tests different ways** | QUICKSTART.md | "Common Commands" |
| **View results** | QUICKSTART.md | "Viewing Results" |
| **Troubleshoot issues** | README.md | "Troubleshooting" |
| **Do manual testing** | MANUAL_TESTING_CHECKLIST.md | Entire document |
| **Understand test coverage** | TEST_SUITE_OVERVIEW.md | "Test Coverage" |
| **See expected outputs** | TEST_SUITE_OVERVIEW.md | "Output Artifacts" |
| **Integrate with CI/CD** | TEST_SUITE_OVERVIEW.md | "Integration with CI/CD" |
| **Customize tests** | README.md | "Troubleshooting" |
| **Get CSV format** | buttons.template.csv | View file |

---

## Quick Command Reference

```bash
# Setup (once)
cd /home/admin/fleet/audio-test
npm install
npm run install:browsers

# Run tests (automated)
./run-test.sh              # Headless (no browser window)
./run-test.sh headed       # Visible browser
./run-test.sh debug        # Step-by-step debugging
./run-test.sh ui           # Interactive UI mode

# Or use npm directly
npm test                   # Headless
npm run test:headed        # Visible browser
npm run test:debug         # Debug mode
npm run test:ui            # UI mode

# View results
cat report.md              # Read markdown report
npm run report             # Open HTML report in browser
cat buttons.csv            # View CSV results

# Debug
npx playwright show-trace artifacts/trace-*.zip
DEBUG=pw:api npm test
```

---

## File Reference

### Test Files
- **audio-controls.test.js** - Main Playwright test suite (automated testing)
- **playwright.config.js** - Test configuration
- **package.json** - Dependencies and npm scripts
- **run-test.sh** - Execution helper script

### Documentation Files
- **README.md** - Main comprehensive documentation
- **QUICKSTART.md** - Quick 3-minute setup and execution guide
- **MANUAL_TESTING_CHECKLIST.md** - Manual testing step-by-step checklist
- **TEST_SUITE_OVERVIEW.md** - Technical overview and architecture
- **DELIVERABLES_SUMMARY.md** - Deliverables and usage summary
- **INDEX.md** - This file (navigation guide)
- **buttons.template.csv** - Example CSV format

### Generated Artifacts (after running tests)
- **report.md** - Generated test report (markdown)
- **buttons.csv** - Generated CSV results
- **screenshots/** - Before/after screenshots
- **artifacts/results.json** - Machine-readable results
- **artifacts/devices.json** - Device enumeration
- **artifacts/network-*.json** - Network logs
- **artifacts/console-*.log** - Console logs
- **artifacts/trace-*.zip** - Playwright traces (contain HAR)
- **playwright-report/** - HTML report

---

## Documentation Summary

### QUICKSTART.md
**Length:** ~200 lines | **Reading Time:** 3 minutes

**What it covers:**
- 3-minute setup and execution
- Quick command reference
- Immediate results interpretation
- Common troubleshooting
- Next steps

**Best for:** First-time users, quick execution

---

### README.md
**Length:** ~500 lines | **Reading Time:** 10-15 minutes

**What it covers:**
- Comprehensive overview
- Prerequisites and setup
- Test execution (all modes)
- Test protocol (A-E phases)
- Test scenarios (6 scenarios)
- Results interpretation
- Manual testing instructions
- Troubleshooting
- Important notes

**Best for:** Complete understanding, setup from scratch

---

### MANUAL_TESTING_CHECKLIST.md
**Length:** ~600 lines | **Reading Time:** 5 minutes (to read), 5-15 min per device (to execute)

**What it covers:**
- Pre-test setup (browser, DevTools)
- Device enumeration
- Per-device testing protocol (5 controls)
- Evidence capture instructions
- Report templates
- CSV template
- Final artifacts export

**Best for:** Manual testing, automated tests unavailable

---

### TEST_SUITE_OVERVIEW.md
**Length:** ~700 lines | **Reading Time:** 15-20 minutes

**What it covers:**
- Test coverage details
- Test protocol (automated)
- File structure
- Execution methods
- Result interpretation
- Output artifacts (detailed)
- CI/CD integration examples
- Troubleshooting
- Maintenance guide
- Best practices
- Security & privacy

**Best for:** Technical deep-dive, CI/CD integration, maintenance

---

### DELIVERABLES_SUMMARY.md
**Length:** ~450 lines | **Reading Time:** 10 minutes

**What it covers:**
- What has been delivered
- Directory structure
- How to use (automated & manual)
- Expected artifacts
- Test execution timeline
- Success criteria examples
- Integration points
- Important notes
- Next steps

**Best for:** Understanding deliverables, quick reference

---

### INDEX.md (This File)
**Length:** ~150 lines | **Reading Time:** 3 minutes

**What it covers:**
- Navigation guide
- Quick reference table
- Command reference
- File reference
- Documentation summaries

**Best for:** Finding the right documentation

---

## Recommended Reading Order

### For First-Time Users
1. **INDEX.md** (this file) - 3 min - Understand what's available
2. **QUICKSTART.md** - 3 min - Get tests running
3. **README.md** - 10 min - Understand the system
4. **TEST_SUITE_OVERVIEW.md** - 15 min - Deep technical understanding

### For Manual Testers
1. **MANUAL_TESTING_CHECKLIST.md** - Follow step-by-step

### For CI/CD Integration
1. **TEST_SUITE_OVERVIEW.md** → "Integration with CI/CD"
2. **README.md** → "Test Protocol"

### For Troubleshooting
1. **QUICKSTART.md** → "Quick Troubleshooting"
2. **README.md** → "Troubleshooting"
3. **TEST_SUITE_OVERVIEW.md** → "Troubleshooting"

---

## Getting Help

### Issue: I don't know where to start
**Solution:** Read QUICKSTART.md, run `./run-test.sh`, view results

### Issue: Tests won't run
**Solution:** README.md → "Troubleshooting" section

### Issue: I need to do manual testing
**Solution:** MANUAL_TESTING_CHECKLIST.md

### Issue: I need to integrate with CI/CD
**Solution:** TEST_SUITE_OVERVIEW.md → "Integration with CI/CD"

### Issue: I need to understand what controls are tested
**Solution:** TEST_SUITE_OVERVIEW.md → "Test Coverage"

### Issue: I need to see expected results format
**Solution:** buttons.template.csv or TEST_SUITE_OVERVIEW.md → "Output Artifacts"

---

## Contact

For issues with the test suite:
1. Check relevant documentation
2. Review generated artifacts
3. Run in debug mode: `npm run test:debug`
4. Check console/network logs

---

**Last Updated:** 2025-10-03
**Version:** 1.0.0
