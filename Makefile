.PHONY: start setup stop api web model

start:
	python start.py start

setup:
	python start.py setup

stop:
	python start.py stop

api:
	python start.py api

web:
	python start.py web

model:
	python start.py model $(name)
