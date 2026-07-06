# Code Cards for Anki — development shortcuts
#
# Thin wrappers around the npm scripts so you don't have to remember the
# exact incantations. Run `make` on its own to see what's available.

.DEFAULT_GOAL := help
.PHONY: help install build test coverage typecheck diagrams check hooks clean

help: ## Show this help
	@echo "Code Cards for Anki — make targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-11s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies
	npm install

build: ## Regenerate the Anki templates in code_cards/
	npm run build

test: ## Run the Jest test suite
	npm test

coverage: ## Run tests with a coverage report
	npm test -- --coverage

typecheck: ## Type-check src/, tests/, and scripts/ (the build never type-checks)
	npx tsc -p tsconfig.json --noEmit
	npx tsc -p tsconfig.jest.json --noEmit

diagrams: ## Render-check the Mermaid architecture diagrams (needs mmdr: cargo install mermaid-rs-renderer --locked)
	npx ts-node scripts/check-diagrams.ts

check: typecheck test build ## Everything a commit should pass: types, tests, build
	@echo "All checks passed."

hooks: ## Install the pre-commit git hooks
	pre-commit install

clean: ## Remove generated test artifacts (coverage/)
	rm -rf coverage
