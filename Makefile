# Code Cards for Anki — development shortcuts
#
# Thin wrappers around the npm scripts so you don't have to remember the
# exact incantations. Run `make` on its own to see what's available.

.DEFAULT_GOAL := help
.PHONY: help install build test coverage check hooks clean

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

check: test build ## Everything a commit should pass: tests, build
	@echo "All checks passed."

hooks: ## Install the pre-commit git hooks
	pre-commit install

clean: ## Remove generated build/test artifacts (dist/, coverage/)
	rm -rf dist coverage
