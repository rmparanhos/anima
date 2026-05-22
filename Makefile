.PHONY: start setup stop backend frontend model

start:
	python start.py start

setup:
	python start.py setup

stop:
	python start.py stop

backend:
	python start.py backend

frontend:
	python start.py frontend

model:
	python start.py model $(name)
