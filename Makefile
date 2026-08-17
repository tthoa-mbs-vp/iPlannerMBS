.PHONY: up down restart logs status ps pb-shell web-shell podman-up podman-down podman-restart-pb podman-logs pb-watch pb-test pb-test-container

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

# ---- podman (podman-compose, dev hot reload) ----
# PB_HOOKS_WATCH=true bật hooks watcher trong container (entrypoint đã override trong
# docker-compose.yml). Watch script scripts/watch-pb.js bù cho inotify không chạy qua
# mount Windows → tự restart container khi sửa pb_hooks/pb_migrations.
podman-up:
	python -m podman_compose up -d --build

podman-down:
	python -m podman_compose down

podman-restart-pb:
	podman restart mbs-planner-pb

podman-logs:
	podman logs -f mbs-planner-pb

pb-watch:
	node scripts/watch-pb.js

# ---- integration tests ----
# pb-test:             chạy harden_integration bằng pocketbase.exe Windows (mặc định)
# pb-test-container:   chạy CHÍNH image production (backend/Dockerfile) trong podman
#                      container — kiểm chứng môi trường deploy giống hệt prod
pb-test:
	node backend/test/harden_integration.test.js

pb-test-container:
	PB_IMAGE=localhost/iplanner_pocketbase:latest node backend/test/harden_integration.test.js
