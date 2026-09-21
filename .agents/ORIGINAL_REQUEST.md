# Original User Request

## 2026-09-20T10:08:24Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Write an automated test suite to verify all core workflows of the project, including the website audit and Google Business Profile features, ensuring all underlying models function properly.

Working directory: /Users/milquu/Documents/Coding Projects/AI Seo
Integrity mode: development

## Verification Resources
- Use the existing test suite and scripts in the repository as a reference and starting point for writing new tests.

## Requirements

### R1. Write unit tests
Focus on writing unit tests for the core logic and models rather than end-to-end user workflows.

### R2. Use existing testing framework
Infer the appropriate testing framework and structure from the existing codebase conventions.

## Acceptance Criteria

### Test Execution
- [ ] All newly written unit tests must pass when the test runner is executed.
- [ ] The test runner must execute without any syntax or import errors.

### Test Coverage
- [ ] The tests must invoke the core models for the website audit and Google Business Profile features at least once.
