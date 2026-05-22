.PHONY: start setup stop backend frontend

start:
	@bash start.sh

setup:
	@bash start.sh --setup-only 2>/dev/null || bash start.sh

backend:
	@cd backend && uvicorn app.main:app --reload

frontend:
	@cd frontend && npm run dev

stop:
	@pkill -f "uvicorn app.main" 2>/dev/null || true
	@pkill -f "next dev" 2>/dev/null || true
	@echo "Anima parado."
