BOLD := \033[1m
DIM := \033[2m
RESET := \033[0m

help:
	@echo "${BOLD}aqqu-frontend:${RESET}	Run server for the Aqqu frontend"
	@echo "${DIM}		The QAC API and the Aqqu API need to be started separately."
	@echo "		Time to load: < 1s | Required RAM: < 1MB${RESET}"


aqqu-frontend:
	python3 /home/aqqu_server.py 80
