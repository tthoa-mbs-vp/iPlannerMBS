.PHONY: up down restart logs status ps pb-shell web-shell

up:
	docker compose up -d --build

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

status:
	docker compose ps

ps: status

pb-shell:
	docker exec -it mbs-planner-pb sh

web-shell:
	docker exec -it mbs-planner-web sh
