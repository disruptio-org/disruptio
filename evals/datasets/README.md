# Evaluation Datasets

This directory contains sample project configurations used to test and evaluate agent diagnostic outputs.

## Structure

Each dataset is a JSON file containing a complete project context snapshot:

- `minimal-project.json` — A project with only a name and description (bare minimum)
- `complete-project.json` — A fully configured project with all context filled

## Usage

These datasets are fed into the agent dry-run endpoints to produce diagnostic outputs,
which are then scored against the rubrics in `../rubrics/`.
