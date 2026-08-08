#!/usr/bin/env bash
# user-data de la instancia EC2 (Amazon Linux 2023) — referencia reproducible.
#
# Qué hace: instala Docker + git, clona el repo público, construye la imagen
# del backend (backend/Dockerfile) y lo arranca leyendo TODA la configuración
# desde SSM Parameter Store (/mindku/prod/*). En ningún momento se escribe un
# archivo .env en disco: los valores van directo de SSM a `docker run -e`.
#
# Requisito: la instancia corre con el rol IAM mindku-ec2-role, que solo
# permite ssm:GetParameter* sobre /mindku/* (+ kms:Decrypt de la key de SSM).
set -euo pipefail

REGION="us-east-1"
REPO_URL="https://github.com/sun-dev-nika/mindkuapp.git"
APP_DIR="/opt/mindku"

dnf install -y docker git
systemctl enable --now docker

git clone "$REPO_URL" "$APP_DIR"
docker build -t notes-web-backend "$APP_DIR/backend"

# Script de arranque/redeploy: se deja en la instancia para poder redeployar
# el backend a mano (git pull + rebuild) — el CI/CD solo cubre el frontend.
cat > /usr/local/bin/run-backend.sh <<'RUN'
#!/usr/bin/env bash
set -euo pipefail
REGION="us-east-1"

# Lee cada parámetro de /mindku/prod/ y lo convierte en un flag `-e NOMBRE=valor`.
# SecureString se descifra aquí (--with-decryption); nunca toca el disco.
ENV_FLAGS=()
while IFS=$'\t' read -r name value; do
  ENV_FLAGS+=(-e "$(basename "$name")=$value")
done < <(aws ssm get-parameters-by-path \
  --path /mindku/prod --with-decryption --region "$REGION" \
  --query 'Parameters[*].[Name,Value]' --output text)

docker rm -f notes-web-backend 2>/dev/null || true
docker run -d --name notes-web-backend --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e NOTES_DB_SSL=true \
  "${ENV_FLAGS[@]}" \
  notes-web-backend
RUN
chmod +x /usr/local/bin/run-backend.sh

/usr/local/bin/run-backend.sh
