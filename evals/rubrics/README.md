# Evaluation Rubrics

Scoring criteria for agent diagnostic outputs. Each rubric defines what constitutes
a correct diagnostic result for a given agent type.

## Scoring Dimensions

### 1. Task Success (40%)
- Does the diagnostic correctly identify missing context?
- Does the status (healthy/warning/critical) match the expected state?
- Is the completeness percentage accurate?

### 2. Issue Detection (30%)
- Are all genuine issues flagged?
- Are there any false positives (flagging issues that don't exist)?
- Are issue descriptions actionable?

### 3. Recommendation Quality (15%)
- Are recommendations relevant to the missing context?
- Are recommendations actionable (not vague)?
- Do recommendations reference specific context modules?

### 4. Output Structure (15%)
- Does the output contain all expected fields for the agent type?
- Are field values in the correct format?
- Is the diagnostic title correct?

## Agent-Specific Criteria

### Solution Architect
- Must check: description, businessGoal, technology, githubConnection
- Must output: feasibilityIndex, architectureReadiness, contextCoverage, frameworkRisks

### Design Agent
- Must check: personas, guidelines, designStyle
- Must output: designReadiness, contextCoverage, screenStructureReady, styleDiscrepancies

### Planning Agent
- Must check: businessGoal, description, personas
- Must output: planningReadiness, epicGeneration, storyGeneration, milestonePlanning

### QA/Test Agent
- Must check: guidelines, personas, technology
- Must output: testReadiness, acceptanceCriteria, integrationTestPlan, securityRegression

## Pass/Fail Thresholds

- **Pass**: Score >= 80% across all dimensions
- **Warning**: Score 60-79%
- **Fail**: Score < 60%
